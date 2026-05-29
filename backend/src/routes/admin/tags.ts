import { FastifyPluginAsync } from 'fastify';
import { eq } from 'drizzle-orm';
import { tags, tagTranslations, languages } from '../../db/schema/index.js';

export const adminTagRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/admin/tags', async () => {
    const db = app.db;
    const tagList = await db.select().from(tags).orderBy(tags.created_at);
    const result = [];
    for (const tag of tagList) {
      const trans = await db.select({ language_code: languages.code, name: tagTranslations.name })
        .from(tagTranslations)
        .innerJoin(languages, eq(tagTranslations.language_id, languages.id))
        .where(eq(tagTranslations.tag_id, tag.id));
      result.push({ ...tag, translations: trans });
    }
    return result;
  });

  app.post('/api/admin/tags', async (request, reply) => {
    const db = app.db;
    const body = request.body as { slug: string; translations: { language_code: string; name: string }[] };
    const now = new Date().toISOString();
    const tagId = crypto.randomUUID();

    try {
      await db.insert(tags).values({ id: tagId, slug: body.slug, created_at: now, updated_at: now });
    } catch {
      return reply.status(409).send({ error: 'Slug already exists' });
    }

    for (const t of (body.translations ?? [])) {
      const langRows = await db.select().from(languages).where(eq(languages.code, t.language_code));
      if (langRows.length === 0) continue;
      await db.insert(tagTranslations).values({ id: crypto.randomUUID(), tag_id: tagId, language_id: langRows[0]!.id, name: t.name });
    }

    return reply.status(201).send({ id: tagId, slug: body.slug });
  });

  app.put('/api/admin/tags/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const db = app.db;
    const body = request.body as { slug?: string; translations?: { language_code: string; name: string }[] };

    const existing = await db.select().from(tags).where(eq(tags.id, id)).limit(1);
    if (existing.length === 0) return reply.status(404).send({ error: 'Not found' });

    const now = new Date().toISOString();
    const updateData: Record<string, unknown> = { updated_at: now };
    if (body.slug !== undefined) updateData.slug = body.slug;
    await db.update(tags).set(updateData).where(eq(tags.id, id));

    if (body.translations) {
      await db.delete(tagTranslations).where(eq(tagTranslations.tag_id, id));
      for (const t of body.translations) {
        const langRows = await db.select().from(languages).where(eq(languages.code, t.language_code));
        if (langRows.length === 0) continue;
        await db.insert(tagTranslations).values({ id: crypto.randomUUID(), tag_id: id, language_id: langRows[0]!.id, name: t.name });
      }
    }

    return { ok: true };
  });

  app.delete('/api/admin/tags/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const db = app.db;
    const existing = await db.select().from(tags).where(eq(tags.id, id)).limit(1);
    if (existing.length === 0) return reply.status(404).send({ error: 'Not found' });
    await db.delete(tagTranslations).where(eq(tagTranslations.tag_id, id));
    await db.delete(tags).where(eq(tags.id, id));
    return { ok: true };
  });
};
