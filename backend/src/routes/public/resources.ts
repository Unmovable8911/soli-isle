import { FastifyPluginAsync } from 'fastify';
import { eq, and, or, desc, lt, inArray, isNotNull, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';
import { resources, resourceTranslations, categories, categoryTranslations } from '../../db/schema/index.js';
import { resolveLanguages } from '../../lib/i18n.js';
import { decodeCursor, paginatedResult } from '../../lib/pagination.js';

export const publicResourceRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/resources', async (request) => {
    const db = app.db;
    const query = request.query as { lang?: string; cursor?: string; limit?: string; category?: string };
    const { active, fallback } = await resolveLanguages(db, query.lang);
    const limit = Math.min(parseInt(query.limit || '20', 10), 50);

    const ra = alias(resourceTranslations, 'ra');
    const rf = alias(resourceTranslations, 'rf');

    const conditions: SQL[] = [or(isNotNull(ra.id), isNotNull(rf.id))!];

    if (query.cursor) {
      conditions.push(lt(resources.created_at, decodeCursor(query.cursor)));
    }

    if (query.category) {
      const catRows = await db.select({ id: categories.id }).from(categories).where(eq(categories.slug, query.category));
      if (catRows.length === 0) return { data: [], next_cursor: null };
      conditions.push(eq(resources.category_id, catRows[0]!.id));
    }

    const rows = await db
      .select({
        id: resources.id,
        url: resources.url,
        cover_image: resources.cover_image,
        created_at: resources.created_at,
        category_id: categories.id,
        category_slug: categories.slug,
        active_id: ra.id,
        active_title: ra.title,
        active_description: ra.description,
        fb_title: rf.title,
        fb_description: rf.description,
      })
      .from(resources)
      .leftJoin(ra, and(eq(resources.id, ra.resource_id), eq(ra.language_id, active.id)))
      .leftJoin(rf, and(eq(resources.id, rf.resource_id), eq(rf.language_id, fallback.id)))
      .leftJoin(categories, eq(resources.category_id, categories.id))
      .where(and(...conditions))
      .orderBy(desc(resources.created_at))
      .limit(limit + 1);

    // Fetch category translations (active + default) for all category IDs in results.
    const catIds = [...new Set(rows.map(r => r.category_id).filter((id): id is string => id !== null))];
    const catActive: Record<string, string> = {};
    const catFallback: Record<string, string> = {};
    if (catIds.length > 0) {
      const catTrans = await db
        .select({ category_id: categoryTranslations.category_id, name: categoryTranslations.name, language_id: categoryTranslations.language_id })
        .from(categoryTranslations)
        .where(and(
          inArray(categoryTranslations.language_id, [active.id, fallback.id]),
          inArray(categoryTranslations.category_id, catIds),
        ));
      for (const ct of catTrans) {
        if (ct.language_id === active.id) catActive[ct.category_id] = ct.name;
        else if (ct.language_id === fallback.id) catFallback[ct.category_id] = ct.name;
      }
    }

    const withCursor = rows.map(r => {
      const useActive = r.active_id != null;
      return {
        id: r.id,
        url: r.url,
        cover_image: r.cover_image,
        created_at: r.created_at,
        lang: useActive ? active.code : fallback.code,
        translation: {
          title: useActive ? r.active_title : r.fb_title,
          description: useActive ? r.active_description : r.fb_description,
        },
        category: r.category_id
          ? { id: r.category_id, slug: r.category_slug!, translation: { name: catActive[r.category_id] ?? catFallback[r.category_id] ?? null } }
          : null,
      };
    });

    const { data: pagedData, next_cursor } = paginatedResult(withCursor, 'created_at', limit);
    const data = pagedData.map(({ created_at: _ts, ...rest }) => rest);
    return { data, next_cursor };
  });
};
