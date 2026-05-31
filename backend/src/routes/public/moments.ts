import { FastifyPluginAsync } from 'fastify';
import { eq, and, desc, inArray, lt } from 'drizzle-orm';
import { moments, momentTranslations, momentTags, tags, tagTranslations } from '../../db/schema/index.js';
import { resolveLanguage } from '../../lib/i18n.js';
import { decodeCursor, paginatedResult } from '../../lib/pagination.js';

const DEFAULT_LIMIT = 20;

export const publicMomentRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/moments', async (request) => {
    const db = app.db;
    const query = request.query as { lang?: string; cursor?: string; limit?: string; tag?: string };
    const { id: langId } = await resolveLanguage(db, query.lang);
    const limit = Math.min(parseInt(query.limit || String(DEFAULT_LIMIT), 10), 50);

    const conditions = [eq(momentTranslations.language_id, langId)] as ReturnType<typeof eq>[];

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
        body: momentTranslations.body,
      })
      .from(moments)
      .innerJoin(momentTranslations, eq(moments.id, momentTranslations.moment_id))
      .where(and(...conditions))
      .orderBy(desc(moments.published_at))
      .limit(limit + 1);

    const momentIds = rows.map(r => r.id);
    const tagMap: Record<string, { id: string; slug: string; name: string | null }[]> = {};
    if (momentIds.length > 0) {
      const tagRows = await db
        .select({ moment_id: momentTags.moment_id, id: tags.id, slug: tags.slug, name: tagTranslations.name })
        .from(momentTags)
        .innerJoin(tags, eq(momentTags.tag_id, tags.id))
        .innerJoin(tagTranslations, and(eq(tags.id, tagTranslations.tag_id), eq(tagTranslations.language_id, langId)))
        .where(inArray(momentTags.moment_id, momentIds));
      for (const t of tagRows) {
        (tagMap[t.moment_id] ??= []).push({ id: t.id, slug: t.slug, name: t.name });
      }
    }

    const data = rows.map(r => ({
      id: r.id,
      published_at: r.published_at,
      translation: { body: r.body },
      tags: (tagMap[r.id] ?? []).map(t => ({ id: t.id, slug: t.slug, translation: { name: t.name } })),
    }));

    return paginatedResult(data, 'published_at', limit);
  });
};
