import { FastifyPluginAsync } from 'fastify';
import { languages } from '../../db/schema/index.js';

export const publicLanguageRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/languages', async () => {
    return app.db.select().from(languages);
  });
};
