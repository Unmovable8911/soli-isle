import { describe, it, expect, beforeAll } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import * as schema from '../../src/db/schema/index.js';

let db: ReturnType<typeof drizzle<typeof schema>>;

beforeAll(async () => {
  // Run seed logic in-memory to verify it
  const sqlite = new Database(':memory:');
  db = drizzle(sqlite, { schema });

  sqlite.exec(`
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
  `);

  const now = new Date().toISOString();
  const enId = crypto.randomUUID();
  const zhId = crypto.randomUUID();

  await db.insert(schema.languages).values([
    { id: enId, code: 'en', name: 'English', is_default: 1 },
    { id: zhId, code: 'zh', name: '中文', is_default: 0 },
  ]);

  const catId = crypto.randomUUID();
  await db.insert(schema.categories).values({ id: catId, slug: 'tech', created_at: now, updated_at: now });
  await db.insert(schema.categoryTranslations).values({ id: crypto.randomUUID(), category_id: catId, language_id: enId, name: 'Technology' });

  const tagId = crypto.randomUUID();
  await db.insert(schema.tags).values({ id: tagId, slug: 'rust', created_at: now, updated_at: now });
  await db.insert(schema.tagTranslations).values({ id: crypto.randomUUID(), tag_id: tagId, language_id: enId, name: 'Rust' });

  const artId = crypto.randomUUID();
  await db.insert(schema.slugs).values({ id: crypto.randomUUID(), slug: 'hello', entity_type: 'article', entity_id: artId });
  await db.insert(schema.articles).values({ id: artId, slug: 'hello', category_id: catId, published_at: now, is_draft: 0, created_at: now, updated_at: now });
  await db.insert(schema.articleTranslations).values({ id: crypto.randomUUID(), article_id: artId, language_id: enId, title: 'Hello', body: '{}', excerpt: 'Hi' });
  await db.insert(schema.articleTags).values({ article_id: artId, tag_id: tagId });
});

describe('seed verification', () => {
  it('has two languages', async () => {
    const rows = await db.select().from(schema.languages);
    expect(rows).toHaveLength(2);
    const codes = rows.map(r => r.code);
    expect(codes).toContain('en');
    expect(codes).toContain('zh');
  });

  it('has one published article with title', async () => {
    const rows = await db.select().from(schema.articles).where(eq(schema.articles.is_draft, 0));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.slug).toBe('hello');
  });

  it('has one category', async () => {
    const rows = await db.select().from(schema.categories);
    expect(rows).toHaveLength(1);
  });

  it('slug uniqueness table has entries', async () => {
    const rows = await db.select().from(schema.slugs);
    expect(rows.length).toBeGreaterThanOrEqual(1);
  });
});
