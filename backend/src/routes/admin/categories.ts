import { FastifyPluginAsync } from 'fastify';
import { eq } from 'drizzle-orm';
import { categories, categoryTranslations, languages } from '../../db/schema/index.js';

export const adminCategoryRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/admin/categories', async () => {
    const db = app.db;
    const cats = await db.select().from(categories).orderBy(categories.created_at);
    const result = [];
    for (const cat of cats) {
      const trans = await db.select({ language_code: languages.code, name: categoryTranslations.name })
        .from(categoryTranslations)
        .innerJoin(languages, eq(categoryTranslations.language_id, languages.id))
        .where(eq(categoryTranslations.category_id, cat.id));
      result.push({ ...cat, translations: trans });
    }
    return result;
  });

  app.post('/api/admin/categories', async (request, reply) => {
    const db = app.db;
    const body = request.body as { slug: string; translations: { language_code: string; name: string }[] };
    const now = new Date().toISOString();
    const catId = crypto.randomUUID();

    try {
      await db.insert(categories).values({ id: catId, slug: body.slug, created_at: now, updated_at: now });
    } catch {
      return reply.status(409).send({ error: 'Slug already exists' });
    }

    for (const t of (body.translations ?? [])) {
      const langRows = await db.select().from(languages).where(eq(languages.code, t.language_code));
      if (langRows.length === 0) continue;
      await db.insert(categoryTranslations).values({ id: crypto.randomUUID(), category_id: catId, language_id: langRows[0]!.id, name: t.name });
    }

    return reply.status(201).send({ id: catId, slug: body.slug });
  });

  app.put('/api/admin/categories/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const db = app.db;
    const body = request.body as { slug?: string; translations?: { language_code: string; name: string }[] };

    const existing = await db.select().from(categories).where(eq(categories.id, id)).limit(1);
    if (existing.length === 0) return reply.status(404).send({ error: 'Not found' });

    const now = new Date().toISOString();
    const updateData: Record<string, unknown> = { updated_at: now };
    if (body.slug !== undefined) updateData.slug = body.slug;
    await db.update(categories).set(updateData).where(eq(categories.id, id));

    if (body.translations) {
      await db.delete(categoryTranslations).where(eq(categoryTranslations.category_id, id));
      for (const t of body.translations) {
        const langRows = await db.select().from(languages).where(eq(languages.code, t.language_code));
        if (langRows.length === 0) continue;
        await db.insert(categoryTranslations).values({ id: crypto.randomUUID(), category_id: id, language_id: langRows[0]!.id, name: t.name });
      }
    }

    return { ok: true };
  });

  app.delete('/api/admin/categories/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const db = app.db;
    const existing = await db.select().from(categories).where(eq(categories.id, id)).limit(1);
    if (existing.length === 0) return reply.status(404).send({ error: 'Not found' });
    await db.delete(categoryTranslations).where(eq(categoryTranslations.category_id, id));
    await db.delete(categories).where(eq(categories.id, id));
    return { ok: true };
  });
};
