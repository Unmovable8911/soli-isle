import { FastifyPluginAsync } from 'fastify';
import { eq } from 'drizzle-orm';
import { socialLinks } from '../../db/schema/index.js';

export const publicSocialLinkRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/social-links', async () => {
    return app.db.select().from(socialLinks).where(eq(socialLinks.is_enabled, 1)).orderBy(socialLinks.sort_order);
  });
};
