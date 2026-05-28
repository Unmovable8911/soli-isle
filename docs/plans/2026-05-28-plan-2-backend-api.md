# Backend API — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Fastify API server with session-based auth, public read-only endpoints with cursor pagination and i18n, and admin CRUD endpoints for all content types and media uploads.

**Architecture:** Fastify server assembled via a `createApp` factory (testable via `.inject()` without binding to a port). Auth via `@fastify/cookie` + `@fastify/session` with a single-admin password from `ADMIN_PASSWORD` env var (bcrypt-hashed at startup). Routes split into `public/` and `admin/` directories. Shared helpers for i18n (resolve `?lang=` with fallback to default language) and cursor-based pagination. Admin routes check session on every request; returns 401 if unauthenticated.

**Tech Stack:** Fastify, @fastify/cookie, @fastify/session, bcrypt, better-sqlite3, Drizzle ORM, Vitest

**Depends on:** Plan 1 (Database Layer) — schema and migration runner must be in place.

---

## File Structure

```
backend/
  src/
    config.ts                     # env var reader
    app.ts                        # createApp() factory
    index.ts                      # entry point — calls createApp and listens
    types.ts                      # Fastify type augmentations
    lib/
      i18n.ts                     # resolveLanguage(), getLanguageId()
      pagination.ts               # encodeCursor, decodeCursor, paginatedResult
      password.ts                 # initPassword(), verifyPassword() using bcrypt
    plugins/
      auth.ts                     # onRequest hook — checks session on /api/admin/*
    routes/
      public/
        articles.ts               # GET /api/articles, GET /api/articles/:slug
        moments.ts                # GET /api/moments
        resources.ts              # GET /api/resources
        pages.ts                  # GET /api/pages, GET /api/pages/:slug
        categories.ts             # GET /api/categories
        tags.ts                   # GET /api/tags
        languages.ts              # GET /api/languages
        ui-strings.ts             # GET /api/ui-strings
      admin/
        auth.ts                   # POST /api/admin/login, POST /api/admin/logout, GET /api/admin/me
        articles.ts               # CRUD /api/admin/articles
        moments.ts                # CRUD /api/admin/moments
        resources.ts              # CRUD /api/admin/resources
        pages.ts                  # CRUD /api/admin/pages
        categories.ts             # CRUD /api/admin/categories
        tags.ts                   # CRUD /api/admin/tags
        languages.ts              # CRUD /api/admin/languages
        ui-strings.ts             # CRUD /api/admin/ui-strings
        media.ts                  # POST/GET/DELETE /api/admin/media
  tests/
    helpers.ts                    # createTestApp() — in-memory SQLite, all tables
    admin/
      auth.test.ts
      articles.test.ts
      moments.test.ts
      resources.test.ts
      pages.test.ts
      categories.test.ts
      tags.test.ts
      languages.test.ts
      ui-strings.test.ts
      media.test.ts
    public/
      articles.test.ts
      moments.test.ts
      resources.test.ts
      pages.test.ts
      categories.test.ts
      tags.test.ts
      languages.test.ts
      ui-strings.test.ts
```

---

### Task 1: Project config, Fastify bootstrap, and test helper

**Files:**
- Create: `backend/src/config.ts`
- Create: `backend/src/types.ts`
- Create: `backend/src/app.ts`
- Create: `backend/src/index.ts`
- Create: `backend/tests/helpers.ts`

- [ ] **Step 1: Install new dependencies**

Run: `cd backend && npm install fastify @fastify/cookie @fastify/session @fastify/multipart bcrypt`
Expected: packages install successfully

- [ ] **Step 2: Create config.ts**

```typescript
export function readConfig() {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    throw new Error('ADMIN_PASSWORD environment variable is required');
  }
  return {
    port: parseInt(process.env.PORT || '3000', 10),
    host: process.env.HOST || '0.0.0.0',
    dbPath: process.env.DB_PATH || './data/soli-isle.db',
    adminPassword,
    sessionSecret: process.env.SESSION_SECRET || 'change-me-in-production',
    mediaDir: process.env.MEDIA_DIR || './data/media',
  };
}
```

- [ ] **Step 3: Create types.ts**

```typescript
import { createDb } from './db/index.js';
import { readConfig } from './config.js';

declare module 'fastify' {
  interface FastifyInstance {
    db: ReturnType<typeof createDb>;
    config: ReturnType<typeof readConfig>;
  }
  interface FastifyRequest {
    isAuthenticated: () => boolean;
  }
}
```

- [ ] **Step 4: Create lib/password.ts**

```typescript
import bcrypt from 'bcrypt';

let hashedPassword: string | null = null;

export async function initPassword(plaintext: string): Promise<void> {
  hashedPassword = await bcrypt.hash(plaintext, 10);
}

export async function verifyPassword(plaintext: string): Promise<boolean> {
  if (!hashedPassword) throw new Error('Password not initialized');
  return bcrypt.compare(plaintext, hashedPassword);
}
```

- [ ] **Step 5: Create app.ts**

```typescript
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import session from '@fastify/session';
import multipart from '@fastify/multipart';
import { readConfig } from './config.js';
import { createDb } from './db/index.js';
import { initPassword } from './lib/password.js';
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

  // Auth middleware — runs before every /api/admin/* except login
  app.addHook('onRequest', async (request, reply) => {
    if (request.url.startsWith('/api/admin/') && request.url !== '/api/admin/login') {
      if (!request.isAuthenticated()) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }
    }
  });

  // Health check
  app.get('/api/health', async () => ({ status: 'ok' }));

  return app;
}
```

- [ ] **Step 6: Create index.ts**

```typescript
import { createApp } from './app.js';
import { readConfig } from './config.js';

async function main() {
  const config = readConfig();
  const app = await createApp();
  await app.listen({ port: config.port, host: config.host });
  console.log(`Server running at http://${config.host}:${config.port}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 7: Create tests/helpers.ts**

```typescript
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import session from '@fastify/session';
import multipart from '@fastify/multipart';
import * as schema from '../src/db/schema/index.js';
import { initPassword } from '../src/lib/password.js';
import type { FastifyInstance } from 'fastify';

// Must be set before importing createApp
process.env.ADMIN_PASSWORD = 'test-password';
process.env.SESSION_SECRET = 'test-secret';

const ALL_TABLES_SQL = `
  CREATE TABLE languages (id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, is_default INTEGER NOT NULL DEFAULT 0);
  CREATE TABLE ui_translations (id TEXT PRIMARY KEY, key TEXT NOT NULL, language_id TEXT NOT NULL REFERENCES languages(id), value TEXT NOT NULL);
  CREATE TABLE categories (id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
  CREATE TABLE category_translations (id TEXT PRIMARY KEY, category_id TEXT NOT NULL REFERENCES categories(id), language_id TEXT NOT NULL REFERENCES languages(id), name TEXT NOT NULL);
  CREATE TABLE tags (id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
  CREATE TABLE tag_translations (id TEXT PRIMARY KEY, tag_id TEXT NOT NULL REFERENCES tags(id), language_id TEXT NOT NULL REFERENCES languages(id), name TEXT NOT NULL);
  CREATE TABLE slugs (id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL);
  CREATE TABLE articles (id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, category_id TEXT REFERENCES categories(id), cover_image TEXT, published_at TEXT, is_draft INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
  CREATE TABLE article_translations (id TEXT PRIMARY KEY, article_id TEXT NOT NULL REFERENCES articles(id) ON DELETE CASCADE, language_id TEXT NOT NULL REFERENCES languages(id), title TEXT NOT NULL, body TEXT NOT NULL, excerpt TEXT);
  CREATE TABLE article_tags (article_id TEXT NOT NULL REFERENCES articles(id) ON DELETE CASCADE, tag_id TEXT NOT NULL REFERENCES tags(id), PRIMARY KEY (article_id, tag_id));
  CREATE TABLE moments (id TEXT PRIMARY KEY, published_at TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
  CREATE TABLE moment_translations (id TEXT PRIMARY KEY, moment_id TEXT NOT NULL REFERENCES moments(id) ON DELETE CASCADE, language_id TEXT NOT NULL REFERENCES languages(id), body TEXT NOT NULL);
  CREATE TABLE moment_tags (moment_id TEXT NOT NULL REFERENCES moments(id) ON DELETE CASCADE, tag_id TEXT NOT NULL REFERENCES tags(id), PRIMARY KEY (moment_id, tag_id));
  CREATE TABLE resources (id TEXT PRIMARY KEY, url TEXT NOT NULL, cover_image TEXT, category_id TEXT REFERENCES categories(id), created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
  CREATE TABLE resource_translations (id TEXT PRIMARY KEY, resource_id TEXT NOT NULL REFERENCES resources(id) ON DELETE CASCADE, language_id TEXT NOT NULL REFERENCES languages(id), title TEXT NOT NULL, description TEXT NOT NULL);
  CREATE TABLE pages (id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, published_at TEXT, is_draft INTEGER NOT NULL DEFAULT 1, sort_order INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
  CREATE TABLE page_translations (id TEXT PRIMARY KEY, page_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE, language_id TEXT NOT NULL REFERENCES languages(id), title TEXT NOT NULL, body TEXT NOT NULL);
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
    sessionSecret: 'test-secret',
    mediaDir: '/tmp/soli-isle-test-media',
  });

  await app.register(cookie);
  await app.register(session, {
    secret: 'test-secret',
    cookie: { secure: false, httpOnly: true, maxAge: 86400 },
    saveUninitialized: false,
  });
  await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } });

  app.decorateRequest('isAuthenticated', function (this: any) {
    return this.session.get('authenticated') === true;
  });

  await initPassword('test-password');

  app.addHook('onRequest', async (request, reply) => {
    if (request.url.startsWith('/api/admin/') && request.url !== '/api/admin/login') {
      if (!request.isAuthenticated()) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }
    }
  });

  app.get('/api/health', async () => ({ status: 'ok' }));

  return app;
}

export async function loginAsAdmin(app: FastifyInstance): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/admin/login',
    payload: { password: 'test-password' },
  });
  return res.headers['set-cookie']!;
}

export const now = new Date().toISOString();

export async function seedLanguage(db: ReturnType<typeof drizzle<typeof schema>>) {
  const enId = crypto.randomUUID();
  await db.insert(schema.languages).values({ id: enId, code: 'en', name: 'English', is_default: 1 });
  await db.insert(schema.languages).values({ id: crypto.randomUUID(), code: 'zh', name: '中文', is_default: 0 });
  return enId;
}
```

- [ ] **Step 8: Verify the test helper works**

Run: `cd backend && npx vitest run --testPathPattern="nonexistent" 2>&1 || true`
Expected: no import errors when test files reference helpers.ts

- [ ] **Step 9: Commit**

```bash
git add backend/src/config.ts backend/src/types.ts backend/src/app.ts backend/src/index.ts backend/src/lib/password.ts backend/tests/helpers.ts backend/package.json backend/package-lock.json
git commit -m "feat: bootstrap Fastify server with session auth and test helper"
```

---

### Task 2: Admin auth routes (login/logout/me)

**Files:**
- Create: `backend/src/routes/admin/auth.ts`
- Create: `backend/tests/admin/auth.test.ts`
- Modify: `backend/src/app.ts` — register auth routes

- [ ] **Step 1: Create admin auth routes**

Create `backend/src/routes/admin/auth.ts`:

```typescript
import { FastifyPluginAsync } from 'fastify';
import { verifyPassword } from '../../lib/password.js';

export const adminAuthRoutes: FastifyPluginAsync = async (app) => {
  app.post('/api/admin/login', async (request, reply) => {
    const { password } = request.body as { password: string };
    if (!password) {
      return reply.status(400).send({ error: 'Password is required' });
    }
    const valid = await verifyPassword(password);
    if (!valid) {
      return reply.status(401).send({ error: 'Invalid password' });
    }
    request.session.set('authenticated', true);
    await request.session.save();
    return { ok: true };
  });

  app.post('/api/admin/logout', async (request) => {
    request.session.destroy();
    return { ok: true };
  });

  app.get('/api/admin/me', async (request) => {
    return { authenticated: request.isAuthenticated() };
  });
};
```

- [ ] **Step 2: Register routes in app.ts**

Add to the end of `createApp()`, before `return app`:

```typescript
import { adminAuthRoutes } from './routes/admin/auth.js';

// Register routes
await app.register(adminAuthRoutes);
```

- [ ] **Step 3: Create auth tests**

Create `backend/tests/admin/auth.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestApp, loginAsAdmin } from '../helpers.js';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;

beforeAll(async () => { app = await createTestApp(); });
afterAll(async () => { await app.close(); });

describe('POST /api/admin/login', () => {
  it('returns 400 when password is missing', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/admin/login', payload: {} });
    expect(res.statusCode).toBe(400);
  });

  it('returns 401 for wrong password', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/admin/login', payload: { password: 'wrong' } });
    expect(res.statusCode).toBe(401);
  });

  it('returns 200 and sets session cookie for correct password', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/admin/login', payload: { password: 'test-password' } });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
    expect(res.headers['set-cookie']).toBeDefined();
  });
});

describe('GET /api/admin/me', () => {
  it('returns unauthenticated without cookie', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/me' });
    expect(res.json()).toEqual({ authenticated: false });
  });

  it('returns authenticated with valid cookie', async () => {
    const cookie = await loginAsAdmin(app);
    const res = await app.inject({ method: 'GET', url: '/api/admin/me', headers: { cookie } });
    expect(res.json()).toEqual({ authenticated: true });
  });
});

describe('POST /api/admin/logout', () => {
  it('clears the session', async () => {
    const cookie = await loginAsAdmin(app);
    const logoutRes = await app.inject({ method: 'POST', url: '/api/admin/logout', headers: { cookie } });
    expect(logoutRes.json()).toEqual({ ok: true });

    const meRes = await app.inject({ method: 'GET', url: '/api/admin/me', headers: { cookie } });
    expect(meRes.json()).toEqual({ authenticated: false });
  });
});
```

- [ ] **Step 4: Run auth tests**

Run: `cd backend && npx vitest run tests/admin/auth.test.ts`
Expected: all 7 tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/admin/auth.ts backend/src/app.ts backend/tests/admin/auth.test.ts
git commit -m "feat: add admin auth routes with login, logout, and session check"
```

---

### Task 3: i18n and pagination library helpers

**Files:**
- Create: `backend/src/lib/i18n.ts`
- Create: `backend/src/lib/pagination.ts`

- [ ] **Step 1: Create lib/i18n.ts**

```typescript
import { eq, sql } from 'drizzle-orm';
import { languages } from '../db/schema/index.js';
import type { createDb } from '../db/index.js';

type Db = ReturnType<typeof createDb>;

export async function resolveLanguage(
  db: Db,
  requestedLang: string | undefined
): Promise<{ code: string; id: string }> {
  // If a language code is provided, verify it exists
  if (requestedLang) {
    const rows = await db.select().from(languages).where(eq(languages.code, requestedLang));
    if (rows.length > 0) return { code: rows[0]!.code, id: rows[0]!.id };
  }
  // Fall back to default language
  const defaults = await db.select().from(languages).where(eq(languages.is_default, 1));
  if (defaults[0]) return { code: defaults[0].code, id: defaults[0].id };
  // Last resort
  const all = await db.select().from(languages);
  if (all[0]) return { code: all[0].code, id: all[0].id };
  throw new Error('No languages configured');
}
```

- [ ] **Step 2: Create lib/pagination.ts**

```typescript
export function encodeCursor(value: string): string {
  return Buffer.from(value).toString('base64url');
}

export function decodeCursor(cursor: string): string {
  return Buffer.from(cursor, 'base64url').toString('utf-8');
}

export interface PaginatedResult<T> {
  data: T[];
  next_cursor: string | null;
}

export function paginatedResult<T>(
  rows: T[],
  cursorField: keyof T,
  limit: number
): PaginatedResult<T> {
  const hasMore = rows.length > limit;
  const data = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor =
    hasMore && data.length > 0
      ? encodeCursor(String(data[data.length - 1]![cursorField]))
      : null;
  return { data, next_cursor: nextCursor };
}
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/lib/i18n.ts backend/src/lib/pagination.ts
git commit -m "feat: add i18n language resolution and cursor pagination helpers"
```

---

### Task 4: Public language, category, and tag endpoints

**Files:**
- Create: `backend/src/routes/public/languages.ts`
- Create: `backend/src/routes/public/categories.ts`
- Create: `backend/src/routes/public/tags.ts`
- Create: `backend/src/routes/public/ui-strings.ts`
- Create: `backend/tests/public/languages.test.ts`
- Create: `backend/tests/public/categories.test.ts`
- Modify: `backend/src/app.ts`

- [ ] **Step 1: Create public languages route**

Create `backend/src/routes/public/languages.ts`:

```typescript
import { FastifyPluginAsync } from 'fastify';
import { languages } from '../../db/schema/index.js';

export const publicLanguageRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/languages', async () => {
    return app.db.select().from(languages);
  });
};
```

- [ ] **Step 2: Create public categories route**

Create `backend/src/routes/public/categories.ts`:

```typescript
import { FastifyPluginAsync } from 'fastify';
import { eq, and } from 'drizzle-orm';
import { categories, categoryTranslations } from '../../db/schema/index.js';
import { resolveLanguage } from '../../lib/i18n.js';

export const publicCategoryRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/categories', async (request) => {
    const { lang } = request.query as { lang?: string };
    const { id: langId } = await resolveLanguage(app.db, lang);

    const rows = await app.db
      .select({
        id: categories.id,
        slug: categories.slug,
        name: categoryTranslations.name,
      })
      .from(categories)
      .innerJoin(
        categoryTranslations,
        and(
          eq(categories.id, categoryTranslations.category_id),
          eq(categoryTranslations.language_id, langId)
        )
      );

    return rows.map(r => ({
      id: r.id,
      slug: r.slug,
      translation: { name: r.name },
    }));
  });
};
```

- [ ] **Step 3: Create public tags route**

Create `backend/src/routes/public/tags.ts`:

```typescript
import { FastifyPluginAsync } from 'fastify';
import { eq, and } from 'drizzle-orm';
import { tags, tagTranslations } from '../../db/schema/index.js';
import { resolveLanguage } from '../../lib/i18n.js';

export const publicTagRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/tags', async (request) => {
    const { lang } = request.query as { lang?: string };
    const { id: langId } = await resolveLanguage(app.db, lang);

    const rows = await app.db
      .select({
        id: tags.id,
        slug: tags.slug,
        name: tagTranslations.name,
      })
      .from(tags)
      .innerJoin(
        tagTranslations,
        and(eq(tags.id, tagTranslations.tag_id), eq(tagTranslations.language_id, langId))
      );

    return rows.map(r => ({
      id: r.id,
      slug: r.slug,
      translation: { name: r.name },
    }));
  });
};
```

- [ ] **Step 4: Create public ui-strings route**

Create `backend/src/routes/public/ui-strings.ts`:

```typescript
import { FastifyPluginAsync } from 'fastify';
import { eq, and, isNull } from 'drizzle-orm';
import { uiTranslations, languages } from '../../db/schema/index.js';

export const publicUIStringsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/ui-strings', async (request, reply) => {
    const { lang } = request.query as { lang?: string };
    if (!lang) {
      return reply.status(400).send({ error: '?lang= parameter is required' });
    }

    // Get language ID for the requested lang
    const langRows = await app.db
      .select()
      .from(languages)
      .where(eq(languages.code, lang));

    if (langRows.length === 0) {
      return reply.status(404).send({ error: `Language not found: ${lang}` });
    }

    const langId = langRows[0]!.id;

    // Get UI strings for requested language
    const rows = await app.db
      .select({ key: uiTranslations.key, value: uiTranslations.value })
      .from(uiTranslations)
      .where(eq(uiTranslations.language_id, langId));

    // Get default language ID for fallback
    const defaultLang = await app.db
      .select()
      .from(languages)
      .where(eq(languages.is_default, 1));

    const defaultLangId = defaultLang[0]?.id;

    // If the requested language is not the default, fill missing keys from default
    if (defaultLangId && defaultLangId !== langId) {
      const existingKeys = new Set(rows.map(r => r.key));
      const defaultRows = await app.db
        .select({ key: uiTranslations.key, value: uiTranslations.value })
        .from(uiTranslations)
        .where(eq(uiTranslations.language_id, defaultLangId));

      for (const dr of defaultRows) {
        if (!existingKeys.has(dr.key)) {
          rows.push({ key: dr.key, value: dr.value });
        }
      }
    }

    // Return as flat key-value map
    const result: Record<string, string> = {};
    for (const r of rows) {
      result[r.key] = r.value;
    }
    return result;
  });
};
```

- [ ] **Step 5: Register all 4 routes in app.ts**

```typescript
import { publicLanguageRoutes } from './routes/public/languages.js';
import { publicCategoryRoutes } from './routes/public/categories.js';
import { publicTagRoutes } from './routes/public/tags.js';
import { publicUIStringsRoutes } from './routes/public/ui-strings.js';

// After admin auth routes:
await app.register(publicLanguageRoutes);
await app.register(publicCategoryRoutes);
await app.register(publicTagRoutes);
await app.register(publicUIStringsRoutes);
```

- [ ] **Step 6: Create a test for public categories**

Create `backend/tests/public/categories.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestApp, seedLanguage, now } from '../helpers.js';
import { categories, categoryTranslations } from '../../src/db/schema/index.js';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;

beforeAll(async () => {
  app = await createTestApp();
  const enId = await seedLanguage(app.db);
  const catId = crypto.randomUUID();
  await app.db.insert(categories).values({ id: catId, slug: 'tech', created_at: now, updated_at: now });
  await app.db.insert(categoryTranslations).values({ id: crypto.randomUUID(), category_id: catId, language_id: enId, name: 'Technology' });
});

afterAll(async () => { await app.close(); });

describe('GET /api/categories', () => {
  it('returns categories with translated names', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/categories?lang=en' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveLength(1);
    expect(body[0].slug).toBe('tech');
    expect(body[0].translation.name).toBe('Technology');
  });
});
```

- [ ] **Step 7: Run category tests**

Run: `cd backend && npx vitest run tests/public/categories.test.ts`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add backend/src/routes/public/languages.ts backend/src/routes/public/categories.ts backend/src/routes/public/tags.ts backend/src/routes/public/ui-strings.ts backend/src/app.ts backend/tests/public/categories.test.ts
git commit -m "feat: add public endpoints for languages, categories, tags, and UI strings"
```

---

### Task 5: Public articles endpoint

**Files:**
- Create: `backend/src/routes/public/articles.ts`
- Create: `backend/tests/public/articles.test.ts`
- Modify: `backend/src/app.ts`

This is the most complex public endpoint — list with filtering + pagination, and detail with nested relations.

- [ ] **Step 1: Create public articles route**

Create `backend/src/routes/public/articles.ts`:

```typescript
import { FastifyPluginAsync } from 'fastify';
import { eq, and, desc, inArray, lt } from 'drizzle-orm';
import {
  articles, articleTranslations, articleTags,
  tags, tagTranslations, categories, categoryTranslations,
} from '../../db/schema/index.js';
import { resolveLanguage } from '../../lib/i18n.js';
import { decodeCursor, paginatedResult } from '../../lib/pagination.js';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

export const publicArticleRoutes: FastifyPluginAsync = async (app) => {
  // GET /api/articles — list published articles
  app.get('/api/articles', async (request) => {
    const db = app.db;
    const query = request.query as { lang?: string; cursor?: string; limit?: string; category?: string; tag?: string };
    const { id: langId } = await resolveLanguage(db, query.lang);
    const limit = Math.min(parseInt(query.limit || String(DEFAULT_LIMIT), 10), MAX_LIMIT);

    // Build subquery for article IDs if filtering by tag
    let articleIds: string[] | undefined;
    if (query.tag) {
      const tagRows = await db.select({ id: tags.id }).from(tags).where(eq(tags.slug, query.tag));
      if (tagRows.length === 0) return { data: [], next_cursor: null };
      const tagArts = await db.select({ article_id: articleTags.article_id })
        .from(articleTags).where(eq(articleTags.tag_id, tagRows[0]!.id));
      articleIds = tagArts.map(r => r.article_id);
    }

    // Build conditions
    const conditions: ReturnType<typeof eq>[] = [eq(articles.is_draft, 0), eq(articleTranslations.language_id, langId)];

    if (query.category) {
      const catRows = await db.select({ id: categories.id }).from(categories).where(eq(categories.slug, query.category));
      if (catRows.length > 0) conditions.push(eq(articles.category_id, catRows[0]!.id));
    }

    if (query.cursor) {
      conditions.push(lt(articles.published_at, decodeCursor(query.cursor)));
    }

    if (articleIds !== undefined) {
      conditions.push(inArray(articles.id, articleIds));
    }

    const rows = await db
      .select({
        id: articles.id,
        slug: articles.slug,
        cover_image: articles.cover_image,
        published_at: articles.published_at,
        created_at: articles.created_at,
        updated_at: articles.updated_at,
        title: articleTranslations.title,
        excerpt: articleTranslations.excerpt,
      })
      .from(articles)
      .innerJoin(articleTranslations, eq(articles.id, articleTranslations.article_id))
      .where(and(...conditions))
      .orderBy(desc(articles.published_at))
      .limit(limit + 1);

    return paginatedResult(rows, 'published_at', limit);
  });

  // GET /api/articles/:slug — detail by slug
  app.get('/api/articles/:slug', async (request, reply) => {
    const db = app.db;
    const { slug } = request.params as { slug: string };
    const { lang } = request.query as { lang?: string };
    const { id: langId } = await resolveLanguage(db, lang);

    const rows = await db
      .select({
        id: articles.id,
        slug: articles.slug,
        cover_image: articles.cover_image,
        published_at: articles.published_at,
        created_at: articles.created_at,
        updated_at: articles.updated_at,
        category_id: categories.id,
        category_slug: categories.slug,
        translation_title: articleTranslations.title,
        translation_body: articleTranslations.body,
        translation_excerpt: articleTranslations.excerpt,
      })
      .from(articles)
      .innerJoin(articleTranslations, and(eq(articles.id, articleTranslations.article_id), eq(articleTranslations.language_id, langId)))
      .leftJoin(categories, eq(articles.category_id, categories.id))
      .where(and(eq(articles.slug, slug), eq(articles.is_draft, 0)))
      .limit(1);

    if (rows.length === 0) return reply.status(404).send({ error: 'Not found' });
    const row = rows[0]!;

    // Fetch tags
    const tagRows = await db
      .select({ id: tags.id, slug: tags.slug, name: tagTranslations.name })
      .from(articleTags)
      .innerJoin(tags, eq(articleTags.tag_id, tags.id))
      .innerJoin(tagTranslations, and(eq(tags.id, tagTranslations.tag_id), eq(tagTranslations.language_id, langId)))
      .where(eq(articleTags.article_id, row.id));

    // Fetch category translation
    let categoryResult = null;
    if (row.category_id) {
      const catTrans = await db
        .select({ name: categoryTranslations.name })
        .from(categoryTranslations)
        .where(and(eq(categoryTranslations.category_id, row.category_id), eq(categoryTranslations.language_id, langId)))
        .limit(1);
      categoryResult = { id: row.category_id, slug: row.category_slug, translation: { name: catTrans[0]?.name ?? null } };
    }

    return {
      id: row.id,
      slug: row.slug,
      cover_image: row.cover_image,
      published_at: row.published_at,
      created_at: row.created_at,
      updated_at: row.updated_at,
      category: categoryResult,
      tags: tagRows.map(t => ({ id: t.id, slug: t.slug, translation: { name: t.name } })),
      translation: { title: row.translation_title, body: row.translation_body, excerpt: row.translation_excerpt },
    };
  });
};
```

- [ ] **Step 2: Create public articles test**

Create `backend/tests/public/articles.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestApp, seedLanguage, now } from '../helpers.js';
import { articles, articleTranslations, categories, categoryTranslations, tags, tagTranslations, articleTags, slugs } from '../../src/db/schema/index.js';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;

beforeAll(async () => {
  app = await createTestApp();
  const enId = await seedLanguage(app.db);
  const nowStr = new Date().toISOString();

  // Create category
  const catId = crypto.randomUUID();
  await app.db.insert(categories).values({ id: catId, slug: 'tech', created_at: now, updated_at: now });
  await app.db.insert(categoryTranslations).values({ id: crypto.randomUUID(), category_id: catId, language_id: enId, name: 'Technology' });

  // Create tag
  const tagId = crypto.randomUUID();
  await app.db.insert(tags).values({ id: tagId, slug: 'rust', created_at: now, updated_at: now });
  await app.db.insert(tagTranslations).values({ id: crypto.randomUUID(), tag_id: tagId, language_id: enId, name: 'Rust' });

  // Create published article
  const artId = crypto.randomUUID();
  await app.db.insert(slugs).values({ id: crypto.randomUUID(), slug: 'hello-world', entity_type: 'article', entity_id: artId });
  await app.db.insert(articles).values({ id: artId, slug: 'hello-world', category_id: catId, published_at: nowStr, is_draft: 0, created_at: now, updated_at: now });
  await app.db.insert(articleTranslations).values({ id: crypto.randomUUID(), article_id: artId, language_id: enId, title: 'Hello World', body: '{"type":"doc","content":[]}', excerpt: 'First post' });
  await app.db.insert(articleTags).values({ article_id: artId, tag_id: tagId });

  // Create draft article (should not appear in public results)
  const draftId = crypto.randomUUID();
  await app.db.insert(slugs).values({ id: crypto.randomUUID(), slug: 'draft-post', entity_type: 'article', entity_id: draftId });
  await app.db.insert(articles).values({ id: draftId, slug: 'draft-post', published_at: nowStr, is_draft: 1, created_at: now, updated_at: now });
  await app.db.insert(articleTranslations).values({ id: crypto.randomUUID(), article_id: draftId, language_id: enId, title: 'Draft', body: '{}', excerpt: null });
});

afterAll(async () => { await app.close(); });

describe('GET /api/articles', () => {
  it('lists published articles only', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/articles?lang=en' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].title).toBe('Hello World');
  });

  it('filters by category slug', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/articles?lang=en&category=tech' });
    expect(res.json().data).toHaveLength(1);
  });

  it('filters by category and returns empty for non-matching', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/articles?lang=en&category=nonexistent' });
    expect(res.json().data).toHaveLength(0);
  });

  it('filters by tag slug', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/articles?lang=en&tag=rust' });
    expect(res.json().data).toHaveLength(1);
  });
});

describe('GET /api/articles/:slug', () => {
  it('returns article detail with tags and category', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/articles/hello-world?lang=en' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.translation.title).toBe('Hello World');
    expect(body.tags).toHaveLength(1);
    expect(body.tags[0].slug).toBe('rust');
    expect(body.category.slug).toBe('tech');
  });

  it('returns 404 for non-existent slug', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/articles/nope?lang=en' });
    expect(res.statusCode).toBe(404);
  });

  it('returns 404 for draft article', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/articles/draft-post?lang=en' });
    expect(res.statusCode).toBe(404);
  });
});
```

- [ ] **Step 3: Register route and run tests**

Add to `app.ts`: `import { publicArticleRoutes } from './routes/public/articles.js';` and `await app.register(publicArticleRoutes);`

Run: `cd backend && npx vitest run tests/public/articles.test.ts`
Expected: all 7 tests PASS

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/public/articles.ts backend/src/app.ts backend/tests/public/articles.test.ts
git commit -m "feat: add public articles endpoint with filtering, pagination, and detail"
```

---

### Task 6: Public moments, resources, and pages endpoints

**Files:**
- Create: `backend/src/routes/public/moments.ts`
- Create: `backend/src/routes/public/resources.ts`
- Create: `backend/src/routes/public/pages.ts`
- Create: `backend/tests/public/moments.test.ts`
- Create: `backend/tests/public/resources.test.ts`
- Create: `backend/tests/public/pages.test.ts`
- Modify: `backend/src/app.ts`

- [ ] **Step 1: Create public moments route**

Create `backend/src/routes/public/moments.ts`:

```typescript
import { FastifyPluginAsync } from 'fastify';
import { eq, and, desc, inArray, lt } from 'drizzle-orm';
import { moments, momentTranslations, momentTags, tags, tagTranslations } from '../../db/schema/index.js';
import { resolveLanguage } from '../../lib/i18n.js';
import { decodeCursor, paginatedResult } from '../../lib/pagination.js';

const DEFAULT_LIMIT = 20;

export const publicMomentRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/moments', async (request) => {
    const db = app.db;
    const query = request.query as { lang?: string; cursor?: string; limit?: string; tag?: string };
    const { id: langId } = await resolveLanguage(db, query.lang);
    const limit = Math.min(parseInt(query.limit || String(DEFAULT_LIMIT), 10), 50);

    const conditions: ReturnType<typeof eq>[] = [eq(momentTranslations.language_id, langId)];

    if (query.cursor) {
      conditions.push(lt(moments.published_at, decodeCursor(query.cursor)));
    }

    if (query.tag) {
      const tagRows = await db.select({ id: tags.id }).from(tags).where(eq(tags.slug, query.tag));
      if (tagRows.length === 0) return { data: [], next_cursor: null };
      const taggedMomentIds = await db.select({ moment_id: momentTags.moment_id })
        .from(momentTags).where(eq(momentTags.tag_id, tagRows[0]!.id));
      conditions.push(inArray(moments.id, taggedMomentIds.map(r => r.moment_id)));
    }

    const rows = await db
      .select({
        id: moments.id,
        published_at: moments.published_at,
        created_at: moments.created_at,
        body: momentTranslations.body,
      })
      .from(moments)
      .innerJoin(momentTranslations, eq(moments.id, momentTranslations.moment_id))
      .where(and(...conditions))
      .orderBy(desc(moments.published_at))
      .limit(limit + 1);

    // Fetch tags for each moment
    const momentIds = rows.map(r => r.id);
    let tagMap: Record<string, { id: string; slug: string; name: string | null }[]> = {};
    if (momentIds.length > 0) {
      const tagRows = await db
        .select({ moment_id: momentTags.moment_id, id: tags.id, slug: tags.slug, name: tagTranslations.name })
        .from(momentTags)
        .innerJoin(tags, eq(momentTags.tag_id, tags.id))
        .innerJoin(tagTranslations, and(eq(tags.id, tagTranslations.tag_id), eq(tagTranslations.language_id, langId)))
        .where(inArray(momentTags.moment_id, momentIds));
      for (const t of tagRows) {
        (tagMap[t.moment_id] ??= []).push({ id: t.id, slug: t.slug, name: t.name });
      }
    }

    const data = rows.map(r => ({
      id: r.id,
      published_at: r.published_at,
      translation: { body: r.body },
      tags: (tagMap[r.id] ?? []).map(t => ({ id: t.id, slug: t.slug, translation: { name: t.name } })),
    }));

    return paginatedResult(data, 'published_at', limit);
  });
};
```

- [ ] **Step 2: Create public resources route**

Create `backend/src/routes/public/resources.ts`:

```typescript
import { FastifyPluginAsync } from 'fastify';
import { eq, and, desc, lt } from 'drizzle-orm';
import { resources, resourceTranslations, categories, categoryTranslations } from '../../db/schema/index.js';
import { resolveLanguage } from '../../lib/i18n.js';
import { decodeCursor, paginatedResult } from '../../lib/pagination.js';

export const publicResourceRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/resources', async (request) => {
    const db = app.db;
    const query = request.query as { lang?: string; cursor?: string; limit?: string; category?: string };
    const { id: langId } = await resolveLanguage(db, query.lang);
    const limit = Math.min(parseInt(query.limit || '20', 10), 50);

    const conditions: ReturnType<typeof eq>[] = [eq(resourceTranslations.language_id, langId)];

    if (query.cursor) {
      conditions.push(lt(resources.created_at, decodeCursor(query.cursor)));
    }

    let catFilter: string | undefined;
    if (query.category) {
      const catRows = await db.select({ id: categories.id }).from(categories).where(eq(categories.slug, query.category));
      if (catRows.length > 0) conditions.push(eq(resources.category_id, catRows[0]!.id));
    }

    const rows = await db
      .select({
        id: resources.id,
        url: resources.url,
        cover_image: resources.cover_image,
        created_at: resources.created_at,
        category_id: categories.id,
        category_slug: categories.slug,
        title: resourceTranslations.title,
        description: resourceTranslations.description,
      })
      .from(resources)
      .innerJoin(resourceTranslations, eq(resources.id, resourceTranslations.resource_id))
      .leftJoin(categories, eq(resources.category_id, categories.id))
      .where(and(...conditions))
      .orderBy(desc(resources.created_at))
      .limit(limit + 1);

    // Fetch category translations
    const catIds = [...new Set(rows.map(r => r.category_id).filter(Boolean))] as string[];
    let catNames: Record<string, string> = {};
    if (catIds.length > 0) {
      const catTrans = await db
        .select({ category_id: categoryTranslations.category_id, name: categoryTranslations.name })
        .from(categoryTranslations)
        .where(and(eq(categoryTranslations.language_id, langId), inArray(categoryTranslations.category_id, catIds)));
      for (const ct of catTrans) { catNames[ct.category_id] = ct.name; }
    }

    const data = rows.map(r => ({
      id: r.id,
      url: r.url,
      cover_image: r.cover_image,
      translation: { title: r.title, description: r.description },
      category: r.category_id ? { id: r.category_id, slug: r.category_slug!, translation: { name: catNames[r.category_id] ?? null } } : null,
    }));

    return paginatedResult(data, 'created_at', limit);
  });
};
```

- [ ] **Step 3: Create public pages route**

Create `backend/src/routes/public/pages.ts`:

```typescript
import { FastifyPluginAsync } from 'fastify';
import { eq, and } from 'drizzle-orm';
import { pages, pageTranslations } from '../../db/schema/index.js';
import { resolveLanguage } from '../../lib/i18n.js';

export const publicPageRoutes: FastifyPluginAsync = async (app) => {
  // GET /api/pages — list published pages
  app.get('/api/pages', async (request) => {
    const { lang } = request.query as { lang?: string };
    const { id: langId } = await resolveLanguage(app.db, lang);

    const rows = await app.db
      .select({
        id: pages.id,
        slug: pages.slug,
        published_at: pages.published_at,
        sort_order: pages.sort_order,
        title: pageTranslations.title,
      })
      .from(pages)
      .innerJoin(pageTranslations, and(eq(pages.id, pageTranslations.page_id), eq(pageTranslations.language_id, langId)))
      .where(eq(pages.is_draft, 0))
      .orderBy(pages.sort_order);

    return rows.map(r => ({
      id: r.id,
      slug: r.slug,
      published_at: r.published_at,
      sort_order: r.sort_order,
      translation: { title: r.title },
    }));
  });

  // GET /api/pages/:slug — detail by slug
  app.get('/api/pages/:slug', async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const { lang } = request.query as { lang?: string };
    const { id: langId } = await resolveLanguage(app.db, lang);

    const rows = await app.db
      .select({
        id: pages.id,
        slug: pages.slug,
        published_at: pages.published_at,
        sort_order: pages.sort_order,
        title: pageTranslations.title,
        body: pageTranslations.body,
      })
      .from(pages)
      .innerJoin(pageTranslations, and(eq(pages.id, pageTranslations.page_id), eq(pageTranslations.language_id, langId)))
      .where(and(eq(pages.slug, slug), eq(pages.is_draft, 0)))
      .limit(1);

    if (rows.length === 0) return reply.status(404).send({ error: 'Not found' });
    const row = rows[0]!;
    return {
      id: row.id,
      slug: row.slug,
      published_at: row.published_at,
      sort_order: row.sort_order,
      translation: { title: row.title, body: row.body },
    };
  });
};
```

- [ ] **Step 4: Create tests for each**

Create tests following the same pattern as the articles tests — seed data in beforeAll, test list and detail endpoints, verify draft filtering. Due to space, the pattern is established in Task 5.

- [ ] **Step 5: Register routes in app.ts and run tests**

```typescript
import { publicMomentRoutes } from './routes/public/moments.js';
import { publicResourceRoutes } from './routes/public/resources.js';
import { publicPageRoutes } from './routes/public/pages.js';

await app.register(publicMomentRoutes);
await app.register(publicResourceRoutes);
await app.register(publicPageRoutes);
```

Run: `cd backend && npx vitest run tests/public/`
Expected: all public endpoint tests PASS

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/public/moments.ts backend/src/routes/public/resources.ts backend/src/routes/public/pages.ts backend/src/app.ts backend/tests/public/
git commit -m "feat: add public endpoints for moments, resources, and pages"
```

---

### Task 7: Admin CRUD — articles

**Files:**
- Create: `backend/src/routes/admin/articles.ts`
- Create: `backend/tests/admin/articles.test.ts`
- Modify: `backend/src/app.ts`

- [ ] **Step 1: Create admin articles route**

Create `backend/src/routes/admin/articles.ts`:

```typescript
import { FastifyPluginAsync } from 'fastify';
import { eq, and, desc } from 'drizzle-orm';
import {
  articles, articleTranslations, articleTags,
  slugs, languages,
} from '../../db/schema/index.js';
import { decodeCursor, paginatedResult } from '../../lib/pagination.js';

export const adminArticleRoutes: FastifyPluginAsync = async (app) => {
  // GET /api/admin/articles — list all (including drafts)
  app.get('/api/admin/articles', async (request) => {
    const query = request.query as { cursor?: string; limit?: string };
    const limit = Math.min(parseInt(query.limit || '20', 10), 50);
    const db = app.db;

    const conditions: ReturnType<typeof eq>[] = [];
    if (query.cursor) {
      conditions.push(lt(articles.created_at, decodeCursor(query.cursor)));
    }

    const rows = await db
      .select({
        id: articles.id,
        slug: articles.slug,
        is_draft: articles.is_draft,
        published_at: articles.published_at,
        created_at: articles.created_at,
        translation_title: articleTranslations.title,
      })
      .from(articles)
      .leftJoin(articleTranslations, eq(articles.id, articleTranslations.article_id))
      .where(and(...conditions))
      .orderBy(desc(articles.created_at))
      .limit(limit + 1);

    // Deduplicate by article ID (one row per translation)
    const seen = new Set<string>();
    const deduped = rows.filter(r => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });

    return paginatedResult(deduped, 'created_at', limit);
  });

  // GET /api/admin/articles/:id — single article with all translations
  app.get('/api/admin/articles/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const db = app.db;

    const articleRows = await db.select().from(articles).where(eq(articles.id, id)).limit(1);
    if (articleRows.length === 0) return reply.status(404).send({ error: 'Not found' });
    const article = articleRows[0]!;

    // Get all translations
    const transRows = await db
      .select({
        language_code: languages.code,
        title: articleTranslations.title,
        body: articleTranslations.body,
        excerpt: articleTranslations.excerpt,
      })
      .from(articleTranslations)
      .innerJoin(languages, eq(articleTranslations.language_id, languages.id))
      .where(eq(articleTranslations.article_id, id));

    // Get tag IDs
    const tagRows = await db
      .select({ tag_id: articleTags.tag_id })
      .from(articleTags)
      .where(eq(articleTags.article_id, id));

    return {
      ...article,
      translations: transRows,
      tag_ids: tagRows.map(t => t.tag_id),
    };
  });

  // POST /api/admin/articles — create
  app.post('/api/admin/articles', async (request, reply) => {
    const db = app.db;
    const body = request.body as {
      slug: string; category_id?: string; cover_image?: string;
      is_draft?: number; published_at?: string;
      translations: { language_code: string; title: string; body: string; excerpt?: string }[];
      tag_ids?: string[];
    };

    const now = new Date().toISOString();
    const artId = crypto.randomUUID();

    // Insert into slugs table for uniqueness
    try {
      await db.insert(slugs).values({ id: crypto.randomUUID(), slug: body.slug, entity_type: 'article', entity_id: artId });
    } catch {
      return reply.status(409).send({ error: 'Slug already exists' });
    }

    await db.insert(articles).values({
      id: artId, slug: body.slug, category_id: body.category_id ?? null,
      cover_image: body.cover_image ?? null, published_at: body.published_at ?? null,
      is_draft: body.is_draft ?? 1, created_at: now, updated_at: now,
    });

    // Create translations
    for (const t of body.translations) {
      const langRows = await db.select().from(languages).where(eq(languages.code, t.language_code));
      if (langRows.length === 0) continue;
      await db.insert(articleTranslations).values({
        id: crypto.randomUUID(), article_id: artId, language_id: langRows[0]!.id,
        title: t.title, body: t.body, excerpt: t.excerpt ?? null,
      });
    }

    // Create tag associations
    if (body.tag_ids) {
      for (const tagId of body.tag_ids) {
        await db.insert(articleTags).values({ article_id: artId, tag_id: tagId });
      }
    }

    return reply.status(201).send({ id: artId, slug: body.slug });
  });

  // PUT /api/admin/articles/:id — update
  app.put('/api/admin/articles/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const db = app.db;
    const body = request.body as {
      slug?: string; category_id?: string; cover_image?: string;
      is_draft?: number; published_at?: string;
      translations?: { language_code: string; title: string; body: string; excerpt?: string }[];
      tag_ids?: string[];
    };

    const existing = await db.select().from(articles).where(eq(articles.id, id)).limit(1);
    if (existing.length === 0) return reply.status(404).send({ error: 'Not found' });

    const now = new Date().toISOString();
    const updateData: Record<string, unknown> = { updated_at: now };
    if (body.slug !== undefined) updateData.slug = body.slug;
    if (body.category_id !== undefined) updateData.category_id = body.category_id;
    if (body.cover_image !== undefined) updateData.cover_image = body.cover_image;
    if (body.is_draft !== undefined) updateData.is_draft = body.is_draft;
    if (body.published_at !== undefined) updateData.published_at = body.published_at;

    await db.update(articles).set(updateData).where(eq(articles.id, id));

    // Update translations
    if (body.translations) {
      await db.delete(articleTranslations).where(eq(articleTranslations.article_id, id));
      for (const t of body.translations) {
        const langRows = await db.select().from(languages).where(eq(languages.code, t.language_code));
        if (langRows.length === 0) continue;
        await db.insert(articleTranslations).values({
          id: crypto.randomUUID(), article_id: id, language_id: langRows[0]!.id,
          title: t.title, body: t.body, excerpt: t.excerpt ?? null,
        });
      }
    }

    // Update tags
    if (body.tag_ids !== undefined) {
      await db.delete(articleTags).where(eq(articleTags.article_id, id));
      for (const tagId of body.tag_ids) {
        await db.insert(articleTags).values({ article_id: id, tag_id: tagId });
      }
    }

    return { ok: true };
  });

  // DELETE /api/admin/articles/:id
  app.delete('/api/admin/articles/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const db = app.db;
    const existing = await db.select().from(articles).where(eq(articles.id, id)).limit(1);
    if (existing.length === 0) return reply.status(404).send({ error: 'Not found' });

    await db.delete(articles).where(eq(articles.id, id));
    await db.delete(slugs).where(eq(slugs.entity_id, id));
    return { ok: true };
  });
};
```

- [ ] **Step 2: Create admin articles test**

Create `backend/tests/admin/articles.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestApp, loginAsAdmin, seedLanguage, now } from '../helpers.js';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
let cookie: string;

beforeAll(async () => {
  app = await createTestApp();
  await seedLanguage(app.db);
  cookie = await loginAsAdmin(app);
});

afterAll(async () => { await app.close(); });

describe('POST /api/admin/articles', () => {
  it('creates an article and returns 201', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/articles',
      headers: { cookie },
      payload: {
        slug: 'test-article',
        is_draft: 0,
        translations: [{ language_code: 'en', title: 'Test', body: '{}' }],
      },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().slug).toBe('test-article');
  });

  it('rejects duplicate slug with 409', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/articles',
      headers: { cookie },
      payload: {
        slug: 'test-article',
        is_draft: 0,
        translations: [{ language_code: 'en', title: 'Dup', body: '{}' }],
      },
    });
    expect(res.statusCode).toBe(409);
  });

  it('returns 401 without auth cookie', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/articles',
      payload: { slug: 'no-auth', translations: [{ language_code: 'en', title: 'X', body: '{}' }] },
    });
    expect(res.statusCode).toBe(401);
  });
});

describe('GET /api/admin/articles', () => {
  it('lists articles including the one just created', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/articles',
      headers: { cookie },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.length).toBeGreaterThanOrEqual(1);
  });
});

describe('PUT /api/admin/articles/:id', () => {
  it('updates an article', async () => {
    // Get the ID of the created article
    const listRes = await app.inject({ method: 'GET', url: '/api/admin/articles', headers: { cookie } });
    const id = listRes.json().data[0].id;

    const res = await app.inject({
      method: 'PUT',
      url: `/api/admin/articles/${id}`,
      headers: { cookie },
      payload: { is_draft: 1 },
    });
    expect(res.statusCode).toBe(200);
  });
});

describe('DELETE /api/admin/articles/:id', () => {
  it('deletes an article', async () => {
    const listRes = await app.inject({ method: 'GET', url: '/api/admin/articles', headers: { cookie } });
    const id = listRes.json().data[0].id;

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/admin/articles/${id}`,
      headers: { cookie },
    });
    expect(res.statusCode).toBe(200);
  });
});
```

- [ ] **Step 3: Register route and run tests**

Add to `app.ts`: `import { adminArticleRoutes } from './routes/admin/articles.js';` and `await app.register(adminArticleRoutes);`

Run: `cd backend && npx vitest run tests/admin/articles.test.ts`
Expected: all tests PASS

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/admin/articles.ts backend/src/app.ts backend/tests/admin/articles.test.ts
git commit -m "feat: add admin CRUD endpoints for articles"
```

---

### Task 8: Admin CRUD — moments, resources, pages, categories, tags, languages, ui-strings, media

**Files:**
- Create: `backend/src/routes/admin/moments.ts`
- Create: `backend/src/routes/admin/resources.ts`
- Create: `backend/src/routes/admin/pages.ts`
- Create: `backend/src/routes/admin/categories.ts`
- Create: `backend/src/routes/admin/tags.ts`
- Create: `backend/src/routes/admin/languages.ts`
- Create: `backend/src/routes/admin/ui-strings.ts`
- Create: `backend/src/routes/admin/media.ts`
- Modify: `backend/src/app.ts`
- Create: Tests under `backend/tests/admin/` for each

- [ ] **Step 1: Create admin CRUD routes for remaining content types**

Each route file follows the same CRUD pattern established in Task 7. Key differences:

- **moments.ts** — No slug, no draft. Required fields: `published_at`, `translations[{body}]`. Tag M2M via `moment_tags`. No `slugs` table entry needed.
- **resources.ts** — No slug, no draft, no tags, no `published_at`. Required: `url`, `translations[{title, description}]`. Optional: `category_id`, `cover_image`.
- **pages.ts** — Has slug (needs `slugs` table entry). Has `is_draft`, `sort_order`. Translations for `title`, `body`. Validate slug against reserved words: `['articles', 'moments', 'resources', 'api', 'admin', 'media']`.
- **categories.ts** — Simple: `slug`, `translations[{name}]`. No draft, no tags.
- **tags.ts** — Simple: `slug`, `translations[{name}]`.
- **languages.ts** — `code`, `name`, `is_default`. Validation: only one language can be `is_default = 1`. Cannot delete the default language.
- **ui-strings.ts** — List by `?language_id=`, create with `{key, language_id, value}`, update, delete. Batch update: `PUT /api/admin/ui-strings` with `{language_id, strings: [{key, value}]}`.
- **media.ts** — `POST /api/admin/media` — accepts multipart file upload, saves to `MEDIA_DIR`, returns `{url: '/media/filename.ext'}`. `GET /api/admin/media` — lists files. `DELETE /api/admin/media/:filename` — deletes file.

Each of these follows the same pattern. See Task 7's articles route for the blueprint. Admin route files should be 30-60 lines each for simple resources (categories, tags), ~80 lines for resources/pages, ~40 lines for media.

- [ ] **Step 2: Create admin tests**

Each admin route needs a test file following the pattern from Task 7 Step 2. Create:
- `tests/admin/moments.test.ts`
- `tests/admin/resources.test.ts`
- `tests/admin/pages.test.ts`
- `tests/admin/categories.test.ts`
- `tests/admin/tags.test.ts`
- `tests/admin/languages.test.ts`
- `tests/admin/ui-strings.test.ts`
- `tests/admin/media.test.ts`

Each test file: seed a language in beforeAll, login as admin, test CRUD operations (create, read, update, delete), test auth rejection (401).

- [ ] **Step 3: Register all admin routes in app.ts**

```typescript
import { adminMomentRoutes } from './routes/admin/moments.js';
import { adminResourceRoutes } from './routes/admin/resources.js';
import { adminPageRoutes } from './routes/admin/pages.js';
import { adminCategoryRoutes } from './routes/admin/categories.js';
import { adminTagRoutes } from './routes/admin/tags.js';
import { adminLanguageRoutes } from './routes/admin/languages.js';
import { adminUIStringsRoutes } from './routes/admin/ui-strings.js';
import { adminMediaRoutes } from './routes/admin/media.js';

await app.register(adminMomentRoutes);
await app.register(adminResourceRoutes);
await app.register(adminPageRoutes);
await app.register(adminCategoryRoutes);
await app.register(adminTagRoutes);
await app.register(adminLanguageRoutes);
await app.register(adminUIStringsRoutes);
await app.register(adminMediaRoutes);
```

- [ ] **Step 4: Serve media files statically**

Add to `app.ts` (after multipart registration):

```typescript
import { existsSync, mkdirSync } from 'fs';
import fastifyStatic from '@fastify/static';

// Ensure media directory exists
const mediaDir = config.mediaDir;
if (!existsSync(mediaDir)) mkdirSync(mediaDir, { recursive: true });

await app.register(fastifyStatic, {
  root: mediaDir,
  prefix: '/media/',
});
```

Install: `cd backend && npm install @fastify/static`

- [ ] **Step 5: Run all tests**

Run: `cd backend && npx vitest run`
Expected: all public + admin tests PASS

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/admin/ backend/src/app.ts backend/tests/admin/ backend/package.json backend/package-lock.json
git commit -m "feat: add admin CRUD for all content types plus media upload"
```

---

## Plan Complete — Verification Checklist

- [ ] `ADMIN_PASSWORD=test npx tsx src/index.ts` starts the server
- [ ] `GET /api/health` returns 200
- [ ] `GET /api/languages` returns languages
- [ ] `GET /api/articles?lang=en` returns published articles
- [ ] `GET /api/articles/:slug?lang=en` returns article detail with tags/category
- [ ] `GET /api/moments?lang=en` returns moments
- [ ] `GET /api/resources?lang=en` returns resources
- [ ] `GET /api/pages?lang=en` returns published pages
- [ ] `GET /api/ui-strings?lang=en` returns key-value map
- [ ] `POST /api/admin/login` with correct password sets session
- [ ] `GET /api/admin/me` with cookie returns `authenticated: true`
- [ ] `POST /api/admin/articles` creates article, `PUT` updates, `DELETE` removes
- [ ] Duplicate slug returns 409
- [ ] All `/api/admin/*` routes return 401 without valid session
- [ ] `POST /api/admin/media` uploads file and returns URL
- [ ] `npx vitest run` — all tests pass
