import { FastifyPluginAsync } from 'fastify';
import { eq, and } from 'drizzle-orm';
import { uiTranslations } from '../../db/schema/index.js';

export const adminUIStringsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/admin/ui-strings', async (request, reply) => {
    const { language_id } = request.query as { language_id?: string };
    if (!language_id) return reply.status(400).send({ error: 'language_id is required' });
    return app.db.select().from(uiTranslations).where(eq(uiTranslations.language_id, language_id));
  });

  app.post('/api/admin/ui-strings', async (request, reply) => {
    const db = app.db;
    const body = request.body as { key: string; language_id: string; value: string };
    const id = crypto.randomUUID();
    try {
      await db.insert(uiTranslations).values({ id, key: body.key, language_id: body.language_id, value: body.value });
    } catch {
      return reply.status(409).send({ error: 'Key already exists for this language' });
    }
    return reply.status(201).send({ id });
  });

  // Batch update: PUT /api/admin/ui-strings with { language_id, strings: [{key, value}] }
  // Must be registered BEFORE /:id route so Fastify matches it first
  app.put('/api/admin/ui-strings', async (request, reply) => {
    const db = app.db;
    const body = request.body as { language_id: string; strings: { key: string; value: string }[] };
    if (!body.language_id || !Array.isArray(body.strings)) {
      return reply.status(400).send({ error: 'language_id and strings[] are required' });
    }
    for (const s of body.strings) {
      const existing = await db.select().from(uiTranslations)
        .where(and(eq(uiTranslations.language_id, body.language_id), eq(uiTranslations.key, s.key)))
        .limit(1);
      if (existing.length > 0) {
        await db.update(uiTranslations).set({ value: s.value })
          .where(and(eq(uiTranslations.language_id, body.language_id), eq(uiTranslations.key, s.key)));
      } else {
        await db.insert(uiTranslations).values({ id: crypto.randomUUID(), key: s.key, language_id: body.language_id, value: s.value });
      }
    }
    return { ok: true };
  });

  app.put('/api/admin/ui-strings/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const db = app.db;
    const body = request.body as { value: string };
    const existing = await db.select().from(uiTranslations).where(eq(uiTranslations.id, id)).limit(1);
    if (existing.length === 0) return reply.status(404).send({ error: 'Not found' });
    await db.update(uiTranslations).set({ value: body.value }).where(eq(uiTranslations.id, id));
    return { ok: true };
  });

  app.delete('/api/admin/ui-strings/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const db = app.db;
    const existing = await db.select().from(uiTranslations).where(eq(uiTranslations.id, id)).limit(1);
    if (existing.length === 0) return reply.status(404).send({ error: 'Not found' });
    await db.delete(uiTranslations).where(eq(uiTranslations.id, id));
    return { ok: true };
  });
};
