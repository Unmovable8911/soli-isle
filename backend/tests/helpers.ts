import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import session from '@fastify/session';
import multipart from '@fastify/multipart';
import * as schema from '../src/db/schema/index.js';
import { initPassword } from '../src/lib/password.js';
import { adminAuthRoutes } from '../src/routes/admin/auth.js';
import { adminArticleRoutes } from '../src/routes/admin/articles.js';
import { adminCategoryRoutes } from '../src/routes/admin/categories.js';
import { adminTagRoutes } from '../src/routes/admin/tags.js';
import { adminLanguageRoutes } from '../src/routes/admin/languages.js';
import { adminUIStringsRoutes } from '../src/routes/admin/ui-strings.js';
import { adminMomentRoutes } from '../src/routes/admin/moments.js';
import { adminResourceRoutes } from '../src/routes/admin/resources.js';
import { adminPageRoutes } from '../src/routes/admin/pages.js';
import { adminMediaRoutes } from '../src/routes/admin/media.js';
import { publicLanguageRoutes } from '../src/routes/public/languages.js';
import { publicCategoryRoutes } from '../src/routes/public/categories.js';
import { publicTagRoutes } from '../src/routes/public/tags.js';
import { publicUIStringsRoutes } from '../src/routes/public/ui-strings.js';
import { publicArticleRoutes } from '../src/routes/public/articles.js';
import { publicMomentRoutes } from '../src/routes/public/moments.js';
import { publicResourceRoutes } from '../src/routes/public/resources.js';
import { publicPageRoutes } from '../src/routes/public/pages.js';
import type { FastifyInstance } from 'fastify';

// Must be set before importing createApp
process.env.ADMIN_PASSWORD = 'test-password';
process.env.SESSION_SECRET = 'test-secret-must-be-32-chars-long!!';

const ALL_TABLES_SQL = `
  CREATE TABLE languages (id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, is_default INTEGER NOT NULL DEFAULT 0);
  CREATE TABLE ui_translations (id TEXT PRIMARY KEY, key TEXT NOT NULL, language_id TEXT NOT NULL REFERENCES languages(id), value TEXT NOT NULL);
  CREATE TABLE categories (id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
  CREATE TABLE category_translations (id TEXT PRIMARY KEY, category_id TEXT NOT NULL REFERENCES categories(id), language_id TEXT NOT NULL REFERENCES languages(id), name TEXT NOT NULL);
  CREATE TABLE tags (id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
  CREATE TABLE tag_translations (id TEXT PRIMARY KEY, tag_id TEXT NOT NULL REFERENCES tags(id), language_id TEXT NOT NULL REFERENCES languages(id), name TEXT NOT NULL);
  CREATE TABLE slugs (id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL);
  CREATE TABLE articles (id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, category_id TEXT REFERENCES categories(id), cover_image TEXT, published_at TEXT, is_draft INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
  CREATE TABLE article_translations (id TEXT PRIMARY KEY, article_id TEXT NOT NULL REFERENCES articles(id), language_id TEXT NOT NULL REFERENCES languages(id), title TEXT NOT NULL, body TEXT NOT NULL, excerpt TEXT);
  CREATE TABLE article_tags (article_id TEXT NOT NULL REFERENCES articles(id), tag_id TEXT NOT NULL REFERENCES tags(id), PRIMARY KEY (article_id, tag_id));
  CREATE TABLE moments (id TEXT PRIMARY KEY, published_at TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
  CREATE TABLE moment_translations (id TEXT PRIMARY KEY, moment_id TEXT NOT NULL REFERENCES moments(id), language_id TEXT NOT NULL REFERENCES languages(id), body TEXT NOT NULL);
  CREATE TABLE moment_tags (moment_id TEXT NOT NULL REFERENCES moments(id), tag_id TEXT NOT NULL REFERENCES tags(id), PRIMARY KEY (moment_id, tag_id));
  CREATE TABLE resources (id TEXT PRIMARY KEY, url TEXT NOT NULL, cover_image TEXT, category_id TEXT REFERENCES categories(id), created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
  CREATE TABLE resource_translations (id TEXT PRIMARY KEY, resource_id TEXT NOT NULL REFERENCES resources(id), language_id TEXT NOT NULL REFERENCES languages(id), title TEXT NOT NULL, description TEXT NOT NULL);
  CREATE TABLE pages (id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, published_at TEXT, is_draft INTEGER NOT NULL DEFAULT 1, sort_order INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
  CREATE TABLE page_translations (id TEXT PRIMARY KEY, page_id TEXT NOT NULL REFERENCES pages(id), language_id TEXT NOT NULL REFERENCES languages(id), title TEXT NOT NULL, body TEXT NOT NULL);
`;

export async function createTestApp(): Promise<FastifyInstance> {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  sqlite.exec(ALL_TABLES_SQL);

  const db = drizzle(sqlite, { schema });

  const app = Fastify({ logger: false });

  app.decorate('db', db);
  app.decorate('config', {
    adminPassword: 'test-password',
    port: 0,
    host: '127.0.0.1',
    dbPath: ':memory:',
    sessionSecret: 'test-secret-must-be-32-chars-long!!',
    mediaDir: '/tmp/soli-isle-test-media',
  });

  await app.register(cookie);
  await app.register(session, {
    secret: 'test-secret-must-be-32-chars-long!!',
    cookie: { secure: false, httpOnly: true, maxAge: 86400 },
    saveUninitialized: false,
  });
  await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } });

  app.decorateRequest('isAuthenticated', function (this: any) {
    return this.session.get('authenticated') === true;
  });

  await initPassword('test-password');

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
  await app.register(publicLanguageRoutes);
  await app.register(publicCategoryRoutes);
  await app.register(publicTagRoutes);
  await app.register(publicUIStringsRoutes);
  await app.register(publicArticleRoutes);
  await app.register(publicMomentRoutes);
  await app.register(publicResourceRoutes);
  await app.register(publicPageRoutes);

  return app;
}

export async function loginAsAdmin(app: FastifyInstance): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/admin/login',
    payload: { password: 'test-password' },
  });
  const cookie = res.headers['set-cookie'];
  return Array.isArray(cookie) ? cookie[0]! : cookie!;
}

export const now = new Date().toISOString();

export async function seedLanguage(db: ReturnType<typeof drizzle<typeof schema>>) {
  const enId = crypto.randomUUID();
  await db.insert(schema.languages).values({ id: enId, code: 'en', name: 'English', is_default: 1 });
  await db.insert(schema.languages).values({ id: crypto.randomUUID(), code: 'zh', name: '中文', is_default: 0 });
  return enId;
}
