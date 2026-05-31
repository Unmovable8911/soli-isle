import { describe, it, expect, beforeAll } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import * as schema from '../../src/db/schema/index.js';

let db: ReturnType<typeof drizzle<typeof schema>>;

beforeAll(() => {
  const sqlite = new Database(':memory:');
  db = drizzle(sqlite, { schema });

  // Create all tables in correct dependency order
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
});

describe('full schema integration', () => {
  const now = new Date().toISOString();
  let langId: string;

  beforeAll(async () => {
    langId = crypto.randomUUID();
    await db.insert(schema.languages).values({ id: langId, code: 'en', name: 'English', is_default: 1 });
  });

  it('creates a full article with category, tags, and translation', async () => {
    const catId = crypto.randomUUID();
    await db.insert(schema.categories).values({ id: catId, slug: 'tech', created_at: now, updated_at: now });
    await db.insert(schema.categoryTranslations).values({ id: crypto.randomUUID(), category_id: catId, language_id: langId, name: 'Technology' });

    const tagId = crypto.randomUUID();
    await db.insert(schema.tags).values({ id: tagId, slug: 'rust', created_at: now, updated_at: now });
    await db.insert(schema.tagTranslations).values({ id: crypto.randomUUID(), tag_id: tagId, language_id: langId, name: 'Rust' });

    const artId = crypto.randomUUID();
    await db.insert(schema.slugs).values({ id: crypto.randomUUID(), slug: 'hello-world', entity_type: 'article', entity_id: artId });
    await db.insert(schema.articles).values({ id: artId, slug: 'hello-world', category_id: catId, published_at: now, is_draft: 0, created_at: now, updated_at: now });
    await db.insert(schema.articleTranslations).values({ id: crypto.randomUUID(), article_id: artId, language_id: langId, title: 'Hello World', body: '{"type":"doc","content":[]}', excerpt: 'First post' });
    await db.insert(schema.articleTags).values({ article_id: artId, tag_id: tagId });

    const rows = await db.select().from(schema.articles)
      .innerJoin(schema.articleTranslations, eq(schema.articles.id, schema.articleTranslations.article_id));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.article_translations.title).toBe('Hello World');
  });

  it('rejects duplicate slug across article and page', () => {
    const sqlite2 = new Database(':memory:');
    const db2 = drizzle(sqlite2, { schema });
    sqlite2.exec(`CREATE TABLE slugs (id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL);`);

    const id1 = crypto.randomUUID();
    db2.insert(schema.slugs).values({ id: id1, slug: 'about', entity_type: 'page', entity_id: crypto.randomUUID() }).run();
    expect(() => {
      db2.insert(schema.slugs).values({ id: crypto.randomUUID(), slug: 'about', entity_type: 'article', entity_id: crypto.randomUUID() }).run();
    }).toThrow();
  });

  it('cascades deletes — removing an article removes its translations', () => {
    const sqlite2 = new Database(':memory:');
    sqlite2.pragma('foreign_keys = ON');
    const db2 = drizzle(sqlite2, { schema });
    sqlite2.exec(`
      CREATE TABLE languages (id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, is_default INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE articles (id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, category_id TEXT, cover_image TEXT, published_at TEXT, is_draft INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE TABLE article_translations (id TEXT PRIMARY KEY, article_id TEXT NOT NULL REFERENCES articles(id) ON DELETE CASCADE, language_id TEXT NOT NULL REFERENCES languages(id), title TEXT NOT NULL, body TEXT NOT NULL, excerpt TEXT);
    `);

    const langId2 = crypto.randomUUID();
    db2.insert(schema.languages).values({ id: langId2, code: 'fr', name: 'French', is_default: 0 }).run();

    const artId = crypto.randomUUID();
    db2.insert(schema.articles).values({ id: artId, slug: 'test', is_draft: 1, created_at: now, updated_at: now }).run();
    db2.insert(schema.articleTranslations).values({ id: crypto.randomUUID(), article_id: artId, language_id: langId2, title: 'Test', body: '{}', excerpt: null }).run();

    db2.delete(schema.articles).where(eq(schema.articles.id, artId)).run();
    const remaining = db2.select().from(schema.articleTranslations).where(eq(schema.articleTranslations.article_id, artId)).all();
    expect(remaining).toHaveLength(0);
  });

  it('default language fallback — fetches translation when it exists', async () => {
    const pageId = crypto.randomUUID();
    await db.insert(schema.slugs).values({ id: crypto.randomUUID(), slug: 'about', entity_type: 'page', entity_id: pageId });
    await db.insert(schema.pages).values({ id: pageId, slug: 'about', published_at: now, is_draft: 0, sort_order: 1, created_at: now, updated_at: now });
    await db.insert(schema.pageTranslations).values({ id: crypto.randomUUID(), page_id: pageId, language_id: langId, title: 'About Me', body: '{"type":"doc","content":[]}' });

    const rows = await db.select().from(schema.pages)
      .innerJoin(schema.pageTranslations, eq(schema.pages.id, schema.pageTranslations.page_id))
      .where(eq(schema.pageTranslations.language_id, langId));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.page_translations.title).toBe('About Me');
  });
});
