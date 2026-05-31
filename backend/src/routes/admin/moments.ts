import { FastifyPluginAsync } from 'fastify';
import { eq, desc, and } from 'drizzle-orm';
import { moments, momentTranslations, momentTags, languages } from '../../db/schema/index.js';

export const adminMomentRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/admin/moments', async () => {
    const db = app.db;
    const defaultLang = await db.select({ id: languages.id }).from(languages)
      .where(eq(languages.is_default, 1)).limit(1);
    // Sentinel that cannot match a real UUID, so the join yields no translation
    // (rather than ALL translations → duplicate rows) when no default language exists.
    const defaultLangId = defaultLang[0]?.id ?? '__no_default__';
    return db
      .select({
        id: moments.id,
        published_at: moments.published_at,
        created_at: moments.created_at,
        updated_at: moments.updated_at,
        translation_body: momentTranslations.body,
      })
      .from(moments)
      .leftJoin(
        momentTranslations,
        and(
          eq(momentTranslations.moment_id, moments.id),
          eq(momentTranslations.language_id, defaultLangId),
        ),
      )
      .orderBy(desc(moments.published_at));
  });

  app.get('/api/admin/moments/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const db = app.db;
    const rows = await db.select().from(moments).where(eq(moments.id, id)).limit(1);
    if (rows.length === 0) return reply.status(404).send({ error: 'Not found' });

    const trans = await db.select({ language_code: languages.code, body: momentTranslations.body })
      .from(momentTranslations)
      .innerJoin(languages, eq(momentTranslations.language_id, languages.id))
      .where(eq(momentTranslations.moment_id, id));

    const tagRows = await db.select({ tag_id: momentTags.tag_id }).from(momentTags).where(eq(momentTags.moment_id, id));
    return { ...rows[0]!, translations: trans, tag_ids: tagRows.map(t => t.tag_id) };
  });

  app.post('/api/admin/moments', async (request, reply) => {
    const db = app.db;
    const body = request.body as { published_at: string; translations: { language_code: string; body: string }[]; tag_ids?: string[] };
    const now = new Date().toISOString();
    const momentId = crypto.randomUUID();

    await db.insert(moments).values({ id: momentId, published_at: body.published_at, created_at: now, updated_at: now });

    for (const t of (body.translations ?? [])) {
      const langRows = await db.select().from(languages).where(eq(languages.code, t.language_code));
      if (langRows.length === 0) continue;
      await db.insert(momentTranslations).values({ id: crypto.randomUUID(), moment_id: momentId, language_id: langRows[0]!.id, body: t.body });
    }

    if (body.tag_ids) {
      for (const tagId of body.tag_ids) {
        await db.insert(momentTags).values({ moment_id: momentId, tag_id: tagId });
      }
    }

    return reply.status(201).send({ id: momentId });
  });

  app.put('/api/admin/moments/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const db = app.db;
    const body = request.body as { published_at?: string; translations?: { language_code: string; body: string }[]; tag_ids?: string[] };

    const existing = await db.select().from(moments).where(eq(moments.id, id)).limit(1);
    if (existing.length === 0) return reply.status(404).send({ error: 'Not found' });

    const now = new Date().toISOString();
    const updateData: Record<string, unknown> = { updated_at: now };
    if (body.published_at !== undefined) updateData.published_at = body.published_at;
    await db.update(moments).set(updateData).where(eq(moments.id, id));

    if (body.translations) {
      await db.delete(momentTranslations).where(eq(momentTranslations.moment_id, id));
      for (const t of body.translations) {
        const langRows = await db.select().from(languages).where(eq(languages.code, t.language_code));
        if (langRows.length === 0) continue;
        await db.insert(momentTranslations).values({ id: crypto.randomUUID(), moment_id: id, language_id: langRows[0]!.id, body: t.body });
      }
    }

    if (body.tag_ids !== undefined) {
      await db.delete(momentTags).where(eq(momentTags.moment_id, id));
      for (const tagId of body.tag_ids) {
        await db.insert(momentTags).values({ moment_id: id, tag_id: tagId });
      }
    }

    return { ok: true };
  });

  app.delete('/api/admin/moments/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const db = app.db;
    const existing = await db.select().from(moments).where(eq(moments.id, id)).limit(1);
    if (existing.length === 0) return reply.status(404).send({ error: 'Not found' });
    // Delete child rows first to satisfy FK constraints (no ON DELETE CASCADE).
    await db.delete(momentTranslations).where(eq(momentTranslations.moment_id, id));
    await db.delete(momentTags).where(eq(momentTags.moment_id, id));
    await db.delete(moments).where(eq(moments.id, id));
    return { ok: true };
  });
};
