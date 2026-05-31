import { FastifyPluginAsync } from 'fastify';
import { eq } from 'drizzle-orm';
import { socialLinks } from '../../db/schema/index.js';
import { isSocialPlatform } from '../../lib/social-catalog.js';

export const adminSocialLinkRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/admin/social-links', async () => {
    return app.db.select().from(socialLinks).orderBy(socialLinks.sort_order);
  });

  app.put('/api/admin/social-links/:platform', async (request, reply) => {
    const { platform } = request.params as { platform: string };
    if (!isSocialPlatform(platform)) return reply.status(400).send({ error: 'Unknown platform' });
    const body = request.body as { url: string; is_enabled?: number; sort_order?: number };
    const db = app.db; const now = new Date().toISOString();
    const existing = await db.select().from(socialLinks).where(eq(socialLinks.platform, platform)).limit(1);
    if (existing.length > 0) {
      await db.update(socialLinks).set({
        url: body.url, is_enabled: body.is_enabled ?? existing[0]!.is_enabled,
        sort_order: body.sort_order ?? existing[0]!.sort_order, updated_at: now,
      }).where(eq(socialLinks.platform, platform));
    } else {
      await db.insert(socialLinks).values({
        id: crypto.randomUUID(), platform, url: body.url,
        is_enabled: body.is_enabled ?? 1, sort_order: body.sort_order ?? 0,
        created_at: now, updated_at: now,
      });
    }
    return { ok: true };
  });
};
