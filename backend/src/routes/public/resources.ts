import { FastifyPluginAsync } from 'fastify';
import { eq, and, desc, lt, inArray } from 'drizzle-orm';
import { resources, resourceTranslations, categories, categoryTranslations } from '../../db/schema/index.js';
import { resolveLanguage } from '../../lib/i18n.js';
import { decodeCursor, paginatedResult } from '../../lib/pagination.js';

export const publicResourceRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/resources', async (request) => {
    const db = app.db;
    const query = request.query as { lang?: string; cursor?: string; limit?: string; category?: string };
    const { id: langId } = await resolveLanguage(db, query.lang);
    const limit = Math.min(parseInt(query.limit || '20', 10), 50);

    const conditions = [eq(resourceTranslations.language_id, langId)] as ReturnType<typeof eq>[];

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
        title: resourceTranslations.title,
        description: resourceTranslations.description,
      })
      .from(resources)
      .innerJoin(resourceTranslations, eq(resources.id, resourceTranslations.resource_id))
      .leftJoin(categories, eq(resources.category_id, categories.id))
      .where(and(...conditions))
      .orderBy(desc(resources.created_at))
      .limit(limit + 1);

    // Fetch category translations for all category IDs in results
    const catIds = [...new Set(rows.map(r => r.category_id).filter((id): id is string => id !== null))];
    const catNames: Record<string, string> = {};
    if (catIds.length > 0) {
      const catTrans = await db
        .select({ category_id: categoryTranslations.category_id, name: categoryTranslations.name })
        .from(categoryTranslations)
        .where(and(eq(categoryTranslations.language_id, langId), inArray(categoryTranslations.category_id, catIds)));
      for (const ct of catTrans) { catNames[ct.category_id] = ct.name; }
    }

    const withCursor = rows.map(r => ({
      id: r.id,
      url: r.url,
      cover_image: r.cover_image,
      created_at: r.created_at,
      translation: { title: r.title, description: r.description },
      category: r.category_id
        ? { id: r.category_id, slug: r.category_slug!, translation: { name: catNames[r.category_id] ?? null } }
        : null,
    }));

    const { data: pagedData, next_cursor } = paginatedResult(withCursor, 'created_at', limit);
    const data = pagedData.map(({ created_at: _ts, ...rest }) => rest);
    return { data, next_cursor };
  });
};
