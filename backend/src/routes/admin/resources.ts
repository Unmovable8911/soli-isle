import { FastifyPluginAsync } from 'fastify';
import { eq, desc, and } from 'drizzle-orm';
import { resources, resourceTranslations, languages } from '../../db/schema/index.js';

export const adminResourceRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/admin/resources', async () => {
    const db = app.db;
    const defaultLang = await db.select({ id: languages.id }).from(languages)
      .where(eq(languages.is_default, 1)).limit(1);
    const defaultLangId = defaultLang[0]?.id;
    return db
      .select({
        id: resources.id,
        url: resources.url,
        cover_image: resources.cover_image,
        category_id: resources.category_id,
        created_at: resources.created_at,
        updated_at: resources.updated_at,
        translation_title: resourceTranslations.title,
      })
      .from(resources)
      .leftJoin(
        resourceTranslations,
        and(
          eq(resourceTranslations.resource_id, resources.id),
          defaultLangId ? eq(resourceTranslations.language_id, defaultLangId) : undefined,
        ),
      )
      .orderBy(desc(resources.created_at));
  });

  app.get('/api/admin/resources/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const db = app.db;
    const rows = await db.select().from(resources).where(eq(resources.id, id)).limit(1);
    if (rows.length === 0) return reply.status(404).send({ error: 'Not found' });

    const trans = await db.select({ language_code: languages.code, title: resourceTranslations.title, description: resourceTranslations.description })
      .from(resourceTranslations)
      .innerJoin(languages, eq(resourceTranslations.language_id, languages.id))
      .where(eq(resourceTranslations.resource_id, id));

    return { ...rows[0]!, translations: trans };
  });

  app.post('/api/admin/resources', async (request, reply) => {
    const db = app.db;
    const body = request.body as { url: string; cover_image?: string; category_id?: string; translations: { language_code: string; title: string; description: string }[] };
    const now = new Date().toISOString();
    const resId = crypto.randomUUID();

    await db.insert(resources).values({ id: resId, url: body.url, cover_image: body.cover_image ?? null, category_id: body.category_id ?? null, created_at: now, updated_at: now });

    for (const t of (body.translations ?? [])) {
      const langRows = await db.select().from(languages).where(eq(languages.code, t.language_code));
      if (langRows.length === 0) continue;
      await db.insert(resourceTranslations).values({ id: crypto.randomUUID(), resource_id: resId, language_id: langRows[0]!.id, title: t.title, description: t.description });
    }

    return reply.status(201).send({ id: resId });
  });

  app.put('/api/admin/resources/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const db = app.db;
    const body = request.body as { url?: string; cover_image?: string; category_id?: string; translations?: { language_code: string; title: string; description: string }[] };

    const existing = await db.select().from(resources).where(eq(resources.id, id)).limit(1);
    if (existing.length === 0) return reply.status(404).send({ error: 'Not found' });

    const now = new Date().toISOString();
    const updateData: Record<string, unknown> = { updated_at: now };
    if (body.url !== undefined) updateData.url = body.url;
    if (body.cover_image !== undefined) updateData.cover_image = body.cover_image;
    if (body.category_id !== undefined) updateData.category_id = body.category_id;
    await db.update(resources).set(updateData).where(eq(resources.id, id));

    if (body.translations) {
      await db.delete(resourceTranslations).where(eq(resourceTranslations.resource_id, id));
      for (const t of body.translations) {
        const langRows = await db.select().from(languages).where(eq(languages.code, t.language_code));
        if (langRows.length === 0) continue;
        await db.insert(resourceTranslations).values({ id: crypto.randomUUID(), resource_id: id, language_id: langRows[0]!.id, title: t.title, description: t.description });
      }
    }

    return { ok: true };
  });

  app.delete('/api/admin/resources/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const db = app.db;
    const existing = await db.select().from(resources).where(eq(resources.id, id)).limit(1);
    if (existing.length === 0) return reply.status(404).send({ error: 'Not found' });
    // Delete child rows first to satisfy FK constraints (no ON DELETE CASCADE).
    await db.delete(resourceTranslations).where(eq(resourceTranslations.resource_id, id));
    await db.delete(resources).where(eq(resources.id, id));
    return { ok: true };
  });
};
