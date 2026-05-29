import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from '../../src/db/schema/index.js';
import { languages } from '../../src/db/schema/languages.js';
import { eq } from 'drizzle-orm';
import { categories } from '../../src/db/schema/categories.js';
import { categoryTranslations } from '../../src/db/schema/category-translations.js';
import { tags } from '../../src/db/schema/tags.js';
import { tagTranslations } from '../../src/db/schema/tag-translations.js';

let db: ReturnType<typeof drizzle>;

beforeAll(async () => {
  const sqlite = new Database(':memory:');
  db = drizzle(sqlite, { schema });
  sqlite.exec(`
    CREATE TABLE languages (id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, is_default INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE ui_translations (id TEXT PRIMARY KEY, key TEXT NOT NULL, language_id TEXT NOT NULL REFERENCES languages(id), value TEXT NOT NULL);
    CREATE TABLE categories (id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE category_translations (id TEXT PRIMARY KEY, category_id TEXT NOT NULL REFERENCES categories(id), language_id TEXT NOT NULL REFERENCES languages(id), name TEXT NOT NULL);
    CREATE TABLE tags (id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE tag_translations (id TEXT PRIMARY KEY, tag_id TEXT NOT NULL REFERENCES tags(id), language_id TEXT NOT NULL REFERENCES languages(id), name TEXT NOT NULL);
  `);
});

describe('languages', () => {
  it('inserts a language and reads it back', async () => {
    await db.insert(languages).values({
      id: crypto.randomUUID(),
      code: 'en',
      name: 'English',
      is_default: 1,
    });
    const rows = await db.select().from(languages).where(eq(languages.code, 'en'));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.name).toBe('English');
    expect(rows[0]!.is_default).toBe(1);
  });

  it('rejects duplicate code', () => {
    const sqlite = new Database(':memory:');
    sqlite.exec(`
      CREATE TABLE languages (
        id TEXT PRIMARY KEY,
        code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        is_default INTEGER NOT NULL DEFAULT 0
      );
    `);
    const d = drizzle(sqlite);
    const id1 = crypto.randomUUID();
    const id2 = crypto.randomUUID();
    d.insert(languages).values({ id: id1, code: 'en', name: 'English', is_default: 1 }).run();
    expect(() => {
      d.insert(languages).values({ id: id2, code: 'en', name: 'English dup', is_default: 0 }).run();
    }).toThrow();
  });
});

describe('categories', () => {
  it('inserts a category with translation', async () => {
    const langId = crypto.randomUUID();
    await db.insert(languages).values({ id: langId, code: 'en-cat', name: 'English', is_default: 1 });

    const catId = crypto.randomUUID();
    const now = new Date().toISOString();
    await db.insert(categories).values({ id: catId, slug: 'tech', created_at: now, updated_at: now });
    await db.insert(categoryTranslations).values({
      id: crypto.randomUUID(),
      category_id: catId,
      language_id: langId,
      name: 'Technology',
    });

    const rows = await db.select().from(categories).innerJoin(
      categoryTranslations,
      eq(categories.id, categoryTranslations.category_id)
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.category_translations.name).toBe('Technology');
  });
});

describe('tags', () => {
  it('inserts a tag with translation', async () => {
    const langId = crypto.randomUUID();
    await db.insert(languages).values({ id: langId, code: 'zh', name: '中文', is_default: 0 });

    const tagId = crypto.randomUUID();
    const now = new Date().toISOString();
    await db.insert(tags).values({ id: tagId, slug: 'rust', created_at: now, updated_at: now });
    await db.insert(tagTranslations).values({
      id: crypto.randomUUID(),
      tag_id: tagId,
      language_id: langId,
      name: 'Rust',
    });

    const rows = await db.select().from(tags).innerJoin(
      tagTranslations,
      eq(tags.id, tagTranslations.tag_id)
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.tag_translations.name).toBe('Rust');
  });
});
