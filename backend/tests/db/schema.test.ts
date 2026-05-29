import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from '../../src/db/schema/index.js';
import { languages } from '../../src/db/schema/languages.js';
import { eq } from 'drizzle-orm';

let db: ReturnType<typeof drizzle>;

beforeAll(async () => {
  const sqlite = new Database(':memory:');
  db = drizzle(sqlite, { schema });
  // We'll add migration runner in Task 11
  sqlite.exec(`
    CREATE TABLE languages (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      is_default INTEGER NOT NULL DEFAULT 0
    );
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
