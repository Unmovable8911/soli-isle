import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import session from '@fastify/session';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import { existsSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import { readConfig } from './config.js';
import { createDb } from './db/index.js';
import { initPassword } from './lib/password.js';
import { adminAuthRoutes } from './routes/admin/auth.js';
import { adminArticleRoutes } from './routes/admin/articles.js';
import { adminCategoryRoutes } from './routes/admin/categories.js';
import { adminTagRoutes } from './routes/admin/tags.js';
import { adminLanguageRoutes } from './routes/admin/languages.js';
import { adminUIStringsRoutes } from './routes/admin/ui-strings.js';
import { adminMomentRoutes } from './routes/admin/moments.js';
import { adminResourceRoutes } from './routes/admin/resources.js';
import { adminPageRoutes } from './routes/admin/pages.js';
import { adminMediaRoutes } from './routes/admin/media.js';
import { adminSocialLinkRoutes } from './routes/admin/social-links.js';
import { publicLanguageRoutes } from './routes/public/languages.js';
import { publicSocialLinkRoutes } from './routes/public/social-links.js';
import { publicCategoryRoutes } from './routes/public/categories.js';
import { publicTagRoutes } from './routes/public/tags.js';
import { publicUIStringsRoutes } from './routes/public/ui-strings.js';
import { publicArticleRoutes } from './routes/public/articles.js';
import { publicMomentRoutes } from './routes/public/moments.js';
import { publicResourceRoutes } from './routes/public/resources.js';
import { publicPageRoutes } from './routes/public/pages.js';
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

  // Static file serving for media uploads
  const mediaDir = resolve(config.mediaDir);
  if (!existsSync(mediaDir)) mkdirSync(mediaDir, { recursive: true });
  await app.register(fastifyStatic, {
    root: mediaDir,
    prefix: '/media/',
  });

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
  await app.register(adminArticleRoutes);
  await app.register(adminMomentRoutes);
  await app.register(adminResourceRoutes);
  await app.register(adminPageRoutes);
  await app.register(adminCategoryRoutes);
  await app.register(adminTagRoutes);
  await app.register(adminLanguageRoutes);
  await app.register(adminUIStringsRoutes);
  await app.register(adminMediaRoutes);
  await app.register(adminSocialLinkRoutes);
  await app.register(publicLanguageRoutes);
  await app.register(publicCategoryRoutes);
  await app.register(publicTagRoutes);
  await app.register(publicUIStringsRoutes);
  await app.register(publicArticleRoutes);
  await app.register(publicMomentRoutes);
  await app.register(publicResourceRoutes);
  await app.register(publicPageRoutes);
  await app.register(publicSocialLinkRoutes);

  return app;
}
