import { FastifyPluginAsync } from 'fastify';
import { eq, ne } from 'drizzle-orm';
import { languages } from '../../db/schema/index.js';

export const adminLanguageRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/admin/languages', async () => {
    return app.db.select().from(languages);
  });

  app.post('/api/admin/languages', async (request, reply) => {
    const db = app.db;
    const body = request.body as { code: string; name: string; is_default?: number };
    const now = new Date().toISOString();
    const langId = crypto.randomUUID();

    // If setting as default, unset any other default
    if (body.is_default === 1) {
      await db.update(languages).set({ is_default: 0 }).where(ne(languages.id, langId));
    }

    try {
      await db.insert(languages).values({ id: langId, code: body.code, name: body.name, is_default: body.is_default ?? 0 });
    } catch {
      return reply.status(409).send({ error: 'Language code already exists' });
    }

    return reply.status(201).send({ id: langId, code: body.code });
  });

  app.put('/api/admin/languages/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const db = app.db;
    const body = request.body as { code?: string; name?: string; is_default?: number };

    const existing = await db.select().from(languages).where(eq(languages.id, id)).limit(1);
    if (existing.length === 0) return reply.status(404).send({ error: 'Not found' });

    // If setting as default, unset all others
    if (body.is_default === 1) {
      await db.update(languages).set({ is_default: 0 }).where(ne(languages.id, id));
    }

    const updateData: Record<string, unknown> = {};
    if (body.code !== undefined) updateData.code = body.code;
    if (body.name !== undefined) updateData.name = body.name;
    if (body.is_default !== undefined) updateData.is_default = body.is_default;

    await db.update(languages).set(updateData).where(eq(languages.id, id));
    return { ok: true };
  });

  app.delete('/api/admin/languages/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const db = app.db;
    const existing = await db.select().from(languages).where(eq(languages.id, id)).limit(1);
    if (existing.length === 0) return reply.status(404).send({ error: 'Not found' });
    if (existing[0]!.is_default === 1) return reply.status(400).send({ error: 'Cannot delete the default language' });
    await db.delete(languages).where(eq(languages.id, id));
    return { ok: true };
  });
};
