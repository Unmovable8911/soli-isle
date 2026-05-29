import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import session from '@fastify/session';
import multipart from '@fastify/multipart';
import { readConfig } from './config.js';
import { createDb } from './db/index.js';
import { initPassword } from './lib/password.js';
import { adminAuthRoutes } from './routes/admin/auth.js';
import { publicLanguageRoutes } from './routes/public/languages.js';
import { publicCategoryRoutes } from './routes/public/categories.js';
import { publicTagRoutes } from './routes/public/tags.js';
import { publicUIStringsRoutes } from './routes/public/ui-strings.js';
import './types.js';

export async function createApp(opts?: { dbPath?: string; disableListen?: boolean }) {
  const config = readConfig();
  const app = Fastify({ logger: !opts?.disableListen });

  // Database
  const db = createDb(opts?.dbPath ?? config.dbPath);
  app.decorate('db', db);
  app.decorate('config', config);

  // Plugins
  await app.register(cookie);
  await app.register(session, {
    secret: config.sessionSecret,
    cookie: { secure: false, httpOnly: true, maxAge: 86400 },
    saveUninitialized: false,
  });
  await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } });

  // Auth decorator
  app.decorateRequest('isAuthenticated', function (this: any) {
    return this.session.get('authenticated') === true;
  });

  // Hash admin password at startup
  await initPassword(config.adminPassword);

  // Auth middleware — runs before every /api/admin/* except login and me
  app.addHook('onRequest', async (request, reply) => {
    if (
      request.url.startsWith('/api/admin/') &&
      request.url !== '/api/admin/login' &&
      request.url !== '/api/admin/me'
    ) {
      if (!request.isAuthenticated()) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }
    }
  });

  // Health check
  app.get('/api/health', async () => ({ status: 'ok' }));

  await app.register(adminAuthRoutes);
  await app.register(publicLanguageRoutes);
  await app.register(publicCategoryRoutes);
  await app.register(publicTagRoutes);
  await app.register(publicUIStringsRoutes);

  return app;
}
