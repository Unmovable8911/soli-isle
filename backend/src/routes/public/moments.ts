import { FastifyPluginAsync } from 'fastify';
import { eq, and, or, desc, inArray, lt, isNotNull, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';
import { moments, momentTranslations, momentTags, tags, tagTranslations } from '../../db/schema/index.js';
import { resolveLanguages } from '../../lib/i18n.js';
import { decodeCursor, paginatedResult } from '../../lib/pagination.js';

const DEFAULT_LIMIT = 20;

export const publicMomentRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/moments', async (request) => {
    const db = app.db;
    const query = request.query as { lang?: string; cursor?: string; limit?: string; tag?: string };
    const { active, fallback } = await resolveLanguages(db, query.lang);
    const limit = Math.min(parseInt(query.limit || String(DEFAULT_LIMIT), 10), 50);

    const ma = alias(momentTranslations, 'ma');
    const mf = alias(momentTranslations, 'mf');

    const conditions: SQL[] = [or(isNotNull(ma.id), isNotNull(mf.id))!];

    if (query.cursor) {
      conditions.push(lt(moments.published_at, decodeCursor(query.cursor)));
    }

    if (query.tag) {
      const tagRows = await db.select({ id: tags.id }).from(tags).where(eq(tags.slug, query.tag));
      if (tagRows.length === 0) return { data: [], next_cursor: null };
      const taggedMomentIds = await db.select({ moment_id: momentTags.moment_id })
        .from(momentTags).where(eq(momentTags.tag_id, tagRows[0]!.id));
      if (taggedMomentIds.length === 0) return { data: [], next_cursor: null };
      conditions.push(inArray(moments.id, taggedMomentIds.map(r => r.moment_id)));
    }

    const rows = await db
      .select({
        id: moments.id,
        published_at: moments.published_at,
        created_at: moments.created_at,
        active_id: ma.id,
        active_body: ma.body,
        fb_body: mf.body,
      })
      .from(moments)
      .leftJoin(ma, and(eq(moments.id, ma.moment_id), eq(ma.language_id, active.id)))
      .leftJoin(mf, and(eq(moments.id, mf.moment_id), eq(mf.language_id, fallback.id)))
      .where(and(...conditions))
      .orderBy(desc(moments.published_at))
      .limit(limit + 1);

    const momentIds = rows.map(r => r.id);
    const tagMap: Record<string, { id: string; slug: string; name: string | null }[]> = {};
    if (momentIds.length > 0) {
      const tta = alias(tagTranslations, 'tta');
      const ttf = alias(tagTranslations, 'ttf');
      const tagRows = await db
        .select({
          moment_id: momentTags.moment_id,
          id: tags.id,
          slug: tags.slug,
          active_name: tta.name,
          fb_name: ttf.name,
        })
        .from(momentTags)
        .innerJoin(tags, eq(momentTags.tag_id, tags.id))
        .leftJoin(tta, and(eq(tags.id, tta.tag_id), eq(tta.language_id, active.id)))
        .leftJoin(ttf, and(eq(tags.id, ttf.tag_id), eq(ttf.language_id, fallback.id)))
        .where(inArray(momentTags.moment_id, momentIds));
      for (const t of tagRows) {
        (tagMap[t.moment_id] ??= []).push({ id: t.id, slug: t.slug, name: t.active_name ?? t.fb_name ?? null });
      }
    }

    const data = rows.map(r => {
      const useActive = r.active_id != null;
      return {
        id: r.id,
        published_at: r.published_at,
        lang: useActive ? active.code : fallback.code,
        translation: { body: useActive ? r.active_body : r.fb_body },
        tags: (tagMap[r.id] ?? []).map(t => ({ id: t.id, slug: t.slug, translation: { name: t.name } })),
      };
    });

    return paginatedResult(data, 'published_at', limit);
  });
};
