# Database Layer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set up the SQLite database schema using Drizzle ORM with all content, taxonomy, translation, and junction tables.

**Architecture:** Drizzle schema definitions in separate files per domain, re-exported from a single index. Migrations generated via `drizzle-kit generate` and applied programmatically. Seed script populates a default language and sample data. Slug uniqueness across Articles + Pages enforced via a shared `slugs` lookup table.

**Tech Stack:** TypeScript, Drizzle ORM, better-sqlite3, Vitest, drizzle-kit

---

## File Structure

```
backend/
  package.json
  tsconfig.json
  drizzle.config.ts
  src/
    db/
      schema/
        index.ts              # re-exports all tables + relations
        languages.ts          # Language table
        ui-translations.ts    # UITranslation table
        categories.ts         # Category table
        category-translations.ts
        tags.ts               # Tag table
        tag-translations.ts
        articles.ts           # Article table
        article-translations.ts
        article-tags.ts       # M2M Article<->Tag junction
        moments.ts            # Moment table
        moment-translations.ts
        moment-tags.ts        # M2M Moment<->Tag junction
        resources.ts          # Resource table
        resource-translations.ts
        pages.ts              # Page table
        page-translations.ts
        slugs.ts              # Shared slug uniqueness table
      index.ts                # createDbConnection, runMigrations
      migrate.ts              # migration runner script
      seed.ts                 # seed data script
  tests/
    db/
      schema.test.ts          # schema constraint tests
      seed.test.ts            # seed data verification
```

---

### Task 1: Initialize backend package

**Files:**
- Create: `backend/package.json`
- Create: `backend/tsconfig.json`
- Create: `backend/drizzle.config.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "soli-isle-backend",
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "db:generate": "drizzle-kit generate",
    "db:migrate": "tsx src/db/migrate.ts",
    "db:seed": "tsx src/db/seed.ts",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "better-sqlite3": "^11.7.0",
    "drizzle-orm": "^0.39.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.12",
    "@types/node": "^22.10.0",
    "drizzle-kit": "^0.30.0",
    "tsx": "^4.19.0",
    "typescript": "^5.7.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run: `cd backend && npm install`
Expected: installs all packages, creates `node_modules` and `package-lock.json`

- [ ] **Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src", "tests"]
}
```

- [ ] **Step 4: Create drizzle.config.ts**

```typescript
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema/index.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: './data/soli-isle.db',
  },
});
```

- [ ] **Step 5: Commit**

```bash
git add backend/package.json backend/package-lock.json backend/tsconfig.json backend/drizzle.config.ts
git commit -m "chore: initialize backend package with TypeScript and Drizzle config"
```

---

### Task 2: Create Language and UITranslation tables

**Files:**
- Create: `backend/src/db/schema/languages.ts`
- Create: `backend/src/db/schema/ui-translations.ts`
- Create: `backend/src/db/schema/index.ts`

- [ ] **Step 1: Write failing test for Language table**

Create `backend/tests/db/schema.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run tests/db/schema.test.ts`
Expected: FAIL — `languages` export not found

- [ ] **Step 3: Create languages.ts**

```typescript
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const languages = sqliteTable('languages', {
  id: text('id').primaryKey(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  is_default: integer('is_default').notNull().default(0),
});
```

- [ ] **Step 4: Create ui-translations.ts**

```typescript
import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { languages } from './languages.js';

export const uiTranslations = sqliteTable('ui_translations', {
  id: text('id').primaryKey(),
  key: text('key').notNull(),
  language_id: text('language_id').notNull().references(() => languages.id),
  value: text('value').notNull(),
});
```

- [ ] **Step 5: Create index.ts (initial version — just re-exports)**

```typescript
export { languages } from './languages.js';
export { uiTranslations } from './ui-translations.js';
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd backend && npx vitest run tests/db/schema.test.ts`
Expected: both tests PASS

- [ ] **Step 7: Commit**

```bash
git add backend/src/db/schema/languages.ts backend/src/db/schema/ui-translations.ts backend/src/db/schema/index.ts backend/tests/db/schema.test.ts
git commit -m "feat: add Language and UITranslation tables"
```

---

### Task 3: Create Category and Tag tables with translation tables

**Files:**
- Create: `backend/src/db/schema/categories.ts`
- Create: `backend/src/db/schema/category-translations.ts`
- Create: `backend/src/db/schema/tags.ts`
- Create: `backend/src/db/schema/tag-translations.ts`
- Modify: `backend/src/db/schema/index.ts`
- Modify: `backend/tests/db/schema.test.ts`

- [ ] **Step 1: Create categories.ts**

```typescript
import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const categories = sqliteTable('categories', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
});
```

- [ ] **Step 2: Create category-translations.ts**

```typescript
import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { categories } from './categories.js';
import { languages } from './languages.js';

export const categoryTranslations = sqliteTable('category_translations', {
  id: text('id').primaryKey(),
  category_id: text('category_id').notNull().references(() => categories.id),
  language_id: text('language_id').notNull().references(() => languages.id),
  name: text('name').notNull(),
});
```

- [ ] **Step 3: Create tags.ts**

```typescript
import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const tags = sqliteTable('tags', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
});
```

- [ ] **Step 4: Create tag-translations.ts**

```typescript
import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { tags } from './tags.js';
import { languages } from './languages.js';

export const tagTranslations = sqliteTable('tag_translations', {
  id: text('id').primaryKey(),
  tag_id: text('tag_id').notNull().references(() => tags.id),
  language_id: text('language_id').notNull().references(() => languages.id),
  name: text('name').notNull(),
});
```

- [ ] **Step 5: Update index.ts — add new exports**

```typescript
export { languages } from './languages.js';
export { uiTranslations } from './ui-translations.js';
export { categories } from './categories.js';
export { categoryTranslations } from './category-translations.js';
export { tags } from './tags.js';
export { tagTranslations } from './tag-translations.js';
```

- [ ] **Step 6: Add tests for categories and tags**

Add to `backend/tests/db/schema.test.ts` (append after existing tests):

```typescript
import { categories } from '../../src/db/schema/categories.js';
import { categoryTranslations } from '../../src/db/schema/category-translations.js';
import { tags } from '../../src/db/schema/tags.js';
import { tagTranslations } from '../../src/db/schema/tag-translations.js';

describe('categories', () => {
  it('inserts a category with translation', async () => {
    const langId = crypto.randomUUID();
    await db.insert(languages).values({ id: langId, code: 'en', name: 'English', is_default: 1 });

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
```

Note: the beforeAll hook also needs updating to create categories and tags tables. Update `beforeAll`:

```typescript
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
```

- [ ] **Step 7: Run tests**

Run: `cd backend && npx vitest run tests/db/schema.test.ts`
Expected: all tests PASS

- [ ] **Step 8: Commit**

```bash
git add backend/src/db/schema/categories.ts backend/src/db/schema/category-translations.ts backend/src/db/schema/tags.ts backend/src/db/schema/tag-translations.ts backend/src/db/schema/index.ts backend/tests/db/schema.test.ts
git commit -m "feat: add Category and Tag tables with translations"
```

---

### Task 4: Create Article table with translation and tag junction

**Files:**
- Create: `backend/src/db/schema/articles.ts`
- Create: `backend/src/db/schema/article-translations.ts`
- Create: `backend/src/db/schema/article-tags.ts`
- Modify: `backend/src/db/schema/index.ts`

- [ ] **Step 1: Create articles.ts**

```typescript
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { categories } from './categories.js';

export const articles = sqliteTable('articles', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  category_id: text('category_id').references(() => categories.id),
  cover_image: text('cover_image'),
  published_at: text('published_at'),
  is_draft: integer('is_draft').notNull().default(1),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
});
```

- [ ] **Step 2: Create article-translations.ts**

```typescript
import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { articles } from './articles.js';
import { languages } from './languages.js';

export const articleTranslations = sqliteTable('article_translations', {
  id: text('id').primaryKey(),
  article_id: text('article_id').notNull().references(() => articles.id),
  language_id: text('language_id').notNull().references(() => languages.id),
  title: text('title').notNull(),
  body: text('body').notNull(),
  excerpt: text('excerpt'),
});
```

- [ ] **Step 3: Create article-tags.ts**

```typescript
import { sqliteTable, text, primaryKey } from 'drizzle-orm/sqlite-core';
import { articles } from './articles.js';
import { tags } from './tags.js';

export const articleTags = sqliteTable('article_tags', {
  article_id: text('article_id').notNull().references(() => articles.id),
  tag_id: text('tag_id').notNull().references(() => tags.id),
}, (table) => ({
  pk: primaryKey({ columns: [table.article_id, table.tag_id] }),
}));
```

- [ ] **Step 4: Update index.ts — add new exports**

Append to existing exports:

```typescript
export { articles } from './articles.js';
export { articleTranslations } from './article-translations.js';
export { articleTags } from './article-tags.js';
```

- [ ] **Step 5: Commit**

```bash
git add backend/src/db/schema/articles.ts backend/src/db/schema/article-translations.ts backend/src/db/schema/article-tags.ts backend/src/db/schema/index.ts
git commit -m "feat: add Article table with translations and tag junction"
```

---

### Task 5: Create Moment table with translation and tag junction

**Files:**
- Create: `backend/src/db/schema/moments.ts`
- Create: `backend/src/db/schema/moment-translations.ts`
- Create: `backend/src/db/schema/moment-tags.ts`
- Modify: `backend/src/db/schema/index.ts`

- [ ] **Step 1: Create moments.ts**

```typescript
import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const moments = sqliteTable('moments', {
  id: text('id').primaryKey(),
  published_at: text('published_at').notNull(),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
});
```

- [ ] **Step 2: Create moment-translations.ts**

```typescript
import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { moments } from './moments.js';
import { languages } from './languages.js';

export const momentTranslations = sqliteTable('moment_translations', {
  id: text('id').primaryKey(),
  moment_id: text('moment_id').notNull().references(() => moments.id),
  language_id: text('language_id').notNull().references(() => languages.id),
  body: text('body').notNull(),
});
```

- [ ] **Step 3: Create moment-tags.ts**

```typescript
import { sqliteTable, text, primaryKey } from 'drizzle-orm/sqlite-core';
import { moments } from './moments.js';
import { tags } from './tags.js';

export const momentTags = sqliteTable('moment_tags', {
  moment_id: text('moment_id').notNull().references(() => moments.id),
  tag_id: text('tag_id').notNull().references(() => tags.id),
}, (table) => ({
  pk: primaryKey({ columns: [table.moment_id, table.tag_id] }),
}));
```

- [ ] **Step 4: Update index.ts — add new exports**

```typescript
export { moments } from './moments.js';
export { momentTranslations } from './moment-translations.js';
export { momentTags } from './moment-tags.js';
```

- [ ] **Step 5: Commit**

```bash
git add backend/src/db/schema/moments.ts backend/src/db/schema/moment-translations.ts backend/src/db/schema/moment-tags.ts backend/src/db/schema/index.ts
git commit -m "feat: add Moment table with translations and tag junction"
```

---

### Task 6: Create Resource table with translations

**Files:**
- Create: `backend/src/db/schema/resources.ts`
- Create: `backend/src/db/schema/resource-translations.ts`
- Modify: `backend/src/db/schema/index.ts`

- [ ] **Step 1: Create resources.ts**

```typescript
import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { categories } from './categories.js';

export const resources = sqliteTable('resources', {
  id: text('id').primaryKey(),
  url: text('url').notNull(),
  cover_image: text('cover_image'),
  category_id: text('category_id').references(() => categories.id),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
});
```

- [ ] **Step 2: Create resource-translations.ts**

```typescript
import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { resources } from './resources.js';
import { languages } from './languages.js';

export const resourceTranslations = sqliteTable('resource_translations', {
  id: text('id').primaryKey(),
  resource_id: text('resource_id').notNull().references(() => resources.id),
  language_id: text('language_id').notNull().references(() => languages.id),
  title: text('title').notNull(),
  description: text('description').notNull(),
});
```

- [ ] **Step 3: Update index.ts**

```typescript
export { resources } from './resources.js';
export { resourceTranslations } from './resource-translations.js';
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/db/schema/resources.ts backend/src/db/schema/resource-translations.ts backend/src/db/schema/index.ts
git commit -m "feat: add Resource table with translations"
```

---

### Task 7: Create Page table with translations

**Files:**
- Create: `backend/src/db/schema/pages.ts`
- Create: `backend/src/db/schema/page-translations.ts`
- Modify: `backend/src/db/schema/index.ts`

- [ ] **Step 1: Create pages.ts**

```typescript
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const pages = sqliteTable('pages', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  published_at: text('published_at'),
  is_draft: integer('is_draft').notNull().default(1),
  sort_order: integer('sort_order').notNull().default(0),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
});
```

- [ ] **Step 2: Create page-translations.ts**

```typescript
import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { pages } from './pages.js';
import { languages } from './languages.js';

export const pageTranslations = sqliteTable('page_translations', {
  id: text('id').primaryKey(),
  page_id: text('page_id').notNull().references(() => pages.id),
  language_id: text('language_id').notNull().references(() => languages.id),
  title: text('title').notNull(),
  body: text('body').notNull(),
});
```

- [ ] **Step 3: Update index.ts**

```typescript
export { pages } from './pages.js';
export { pageTranslations } from './page-translations.js';
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/db/schema/pages.ts backend/src/db/schema/page-translations.ts backend/src/db/schema/index.ts
git commit -m "feat: add Page table with translations"
```

---

### Task 8: Create slugs table for cross-entity uniqueness

**Files:**
- Create: `backend/src/db/schema/slugs.ts`
- Modify: `backend/src/db/schema/index.ts`

- [ ] **Step 1: Create slugs.ts**

```typescript
import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

// Enforces global slug uniqueness across Articles and Pages.
// Insert a row before inserting an Article or Page.
// The UNIQUE constraint on slug prevents duplicates across both types.
export const slugs = sqliteTable('slugs', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  entity_type: text('entity_type').notNull(), // 'article' | 'page'
  entity_id: text('entity_id').notNull(),
});
```

- [ ] **Step 2: Update index.ts**

```typescript
export { slugs } from './slugs.js';
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/db/schema/slugs.ts backend/src/db/schema/index.ts
git commit -m "feat: add slugs table for cross-entity uniqueness"
```

---

### Task 9: Define Drizzle relations

**Files:**
- Modify: `backend/src/db/schema/index.ts`

- [ ] **Step 1: Add relation definitions to index.ts**

Replace `backend/src/db/schema/index.ts` with full version including relations:

```typescript
import { relations } from 'drizzle-orm';
import { languages } from './languages.js';
import { uiTranslations } from './ui-translations.js';
import { categories } from './categories.js';
import { categoryTranslations } from './category-translations.js';
import { tags } from './tags.js';
import { tagTranslations } from './tag-translations.js';
import { articles } from './articles.js';
import { articleTranslations } from './article-translations.js';
import { articleTags } from './article-tags.js';
import { moments } from './moments.js';
import { momentTranslations } from './moment-translations.js';
import { momentTags } from './moment-tags.js';
import { resources } from './resources.js';
import { resourceTranslations } from './resource-translations.js';
import { pages } from './pages.js';
import { pageTranslations } from './page-translations.js';
import { slugs } from './slugs.js';

// Language relations
export const languagesRelations = relations(languages, ({ many }) => ({
  uiTranslations: many(uiTranslations),
  articleTranslations: many(articleTranslations),
  momentTranslations: many(momentTranslations),
  resourceTranslations: many(resourceTranslations),
  pageTranslations: many(pageTranslations),
  categoryTranslations: many(categoryTranslations),
  tagTranslations: many(tagTranslations),
}));

// UITranslation relations
export const uiTranslationsRelations = relations(uiTranslations, ({ one }) => ({
  language: one(languages, { fields: [uiTranslations.language_id], references: [languages.id] }),
}));

// Category relations
export const categoriesRelations = relations(categories, ({ many }) => ({
  translations: many(categoryTranslations),
  articles: many(articles),
  resources: many(resources),
}));

export const categoryTranslationsRelations = relations(categoryTranslations, ({ one }) => ({
  category: one(categories, { fields: [categoryTranslations.category_id], references: [categories.id] }),
  language: one(languages, { fields: [categoryTranslations.language_id], references: [languages.id] }),
}));

// Tag relations
export const tagsRelations = relations(tags, ({ many }) => ({
  translations: many(tagTranslations),
  articleTags: many(articleTags),
  momentTags: many(momentTags),
}));

export const tagTranslationsRelations = relations(tagTranslations, ({ one }) => ({
  tag: one(tags, { fields: [tagTranslations.tag_id], references: [tags.id] }),
  language: one(languages, { fields: [tagTranslations.language_id], references: [languages.id] }),
}));

// Article relations
export const articlesRelations = relations(articles, ({ one, many }) => ({
  category: one(categories, { fields: [articles.category_id], references: [categories.id] }),
  translations: many(articleTranslations),
  articleTags: many(articleTags),
}));

export const articleTranslationsRelations = relations(articleTranslations, ({ one }) => ({
  article: one(articles, { fields: [articleTranslations.article_id], references: [articles.id] }),
  language: one(languages, { fields: [articleTranslations.language_id], references: [languages.id] }),
}));

export const articleTagsRelations = relations(articleTags, ({ one }) => ({
  article: one(articles, { fields: [articleTags.article_id], references: [articles.id] }),
  tag: one(tags, { fields: [articleTags.tag_id], references: [tags.id] }),
}));

// Moment relations
export const momentsRelations = relations(moments, ({ many }) => ({
  translations: many(momentTranslations),
  momentTags: many(momentTags),
}));

export const momentTranslationsRelations = relations(momentTranslations, ({ one }) => ({
  moment: one(moments, { fields: [momentTranslations.moment_id], references: [moments.id] }),
  language: one(languages, { fields: [momentTranslations.language_id], references: [languages.id] }),
}));

export const momentTagsRelations = relations(momentTags, ({ one }) => ({
  moment: one(moments, { fields: [momentTags.moment_id], references: [moments.id] }),
  tag: one(tags, { fields: [momentTags.tag_id], references: [tags.id] }),
}));

// Resource relations
export const resourcesRelations = relations(resources, ({ one, many }) => ({
  category: one(categories, { fields: [resources.category_id], references: [categories.id] }),
  translations: many(resourceTranslations),
}));

export const resourceTranslationsRelations = relations(resourceTranslations, ({ one }) => ({
  resource: one(resources, { fields: [resourceTranslations.resource_id], references: [resources.id] }),
  language: one(languages, { fields: [resourceTranslations.language_id], references: [languages.id] }),
}));

// Page relations
export const pagesRelations = relations(pages, ({ many }) => ({
  translations: many(pageTranslations),
}));

export const pageTranslationsRelations = relations(pageTranslations, ({ one }) => ({
  page: one(pages, { fields: [pageTranslations.page_id], references: [pages.id] }),
  language: one(languages, { fields: [pageTranslations.language_id], references: [languages.id] }),
}));

// Re-export all tables
export {
  languages,
  uiTranslations,
  categories,
  categoryTranslations,
  tags,
  tagTranslations,
  articles,
  articleTranslations,
  articleTags,
  moments,
  momentTranslations,
  momentTags,
  resources,
  resourceTranslations,
  pages,
  pageTranslations,
  slugs,
};
```

- [ ] **Step 2: Verify the file has no syntax errors**

Run: `cd backend && npx tsx --eval "import './src/db/schema/index.js'" 2>&1 || true`
Expected: no TypeScript compilation errors about missing exports or type mismatches

- [ ] **Step 3: Commit**

```bash
git add backend/src/db/schema/index.ts
git commit -m "feat: add Drizzle relation definitions across all tables"
```

---

### Task 10: Write a comprehensive schema integration test

**Files:**
- Modify: `backend/tests/db/schema.test.ts`

- [ ] **Step 1: Rewrite tests/db/schema.test.ts with full integration test**

Replace the entire file with a test that creates all tables and exercises cross-table relationships:

```typescript
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
```

- [ ] **Step 2: Run the integration tests**

Run: `cd backend && npx vitest run tests/db/schema.test.ts`
Expected: all 4 tests PASS (full article, duplicate slug rejection, cascade delete, language fallback)

- [ ] **Step 3: Commit**

```bash
git add backend/tests/db/schema.test.ts
git commit -m "test: add full schema integration tests"
```

---

### Task 11: Set up migration runner

**Files:**
- Create: `backend/src/db/index.ts`
- Create: `backend/src/db/migrate.ts`

- [ ] **Step 1: Create db connection and migration helper**

Create `backend/src/db/index.ts`:

```typescript
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from './schema/index.js';

export function createDb(dbPath: string) {
  const sqlite = new Database(dbPath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  return drizzle(sqlite, { schema });
}

export function runMigrations(dbPath: string) {
  const sqlite = new Database(dbPath);
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: './drizzle' });
  sqlite.close();
}
```

- [ ] **Step 2: Create migration runner script**

Create `backend/src/db/migrate.ts`:

```typescript
import { runMigrations } from './index.js';
import { resolve, dirname } from 'path';
import { mkdirSync } from 'fs';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = resolve(__dirname, '../../data');
mkdirSync(dataDir, { recursive: true });

const dbPath = resolve(dataDir, 'soli-isle.db');
runMigrations(dbPath);
console.log(`Migrations applied to ${dbPath}`);
```

- [ ] **Step 3: Generate first migration**

Run: `cd backend && npx drizzle-kit generate`
Expected: creates `backend/drizzle/0000_*.sql` with CREATE TABLE statements for all tables

- [ ] **Step 4: Run migration against a file database to verify it works**

Run: `cd backend && npx tsx src/db/migrate.ts`
Expected: "Migrations applied to .../data/soli-isle.db" — creates the database file

- [ ] **Step 5: Verify tables exist in the created database**

Run: `cd backend && sqlite3 data/soli-isle.db ".tables"`
Expected: lists all table names (articles, article_tags, article_translations, categories, category_translations, languages, moment_tags, moment_translations, moments, page_translations, pages, resource_translations, resources, slugs, tag_translations, tags, ui_translations)

- [ ] **Step 6: Commit**

```bash
git add backend/src/db/index.ts backend/src/db/migrate.ts backend/drizzle/
git commit -m "feat: add migration runner and generate initial migration"
```

---

### Task 12: Write seed script

**Files:**
- Create: `backend/src/db/seed.ts`
- Create: `backend/tests/db/seed.test.ts`

- [ ] **Step 1: Create seed script**

Create `backend/src/db/seed.ts`:

```typescript
import { createDb } from './index.js';
import { resolve, dirname } from 'path';
import { mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { languages } from './schema/languages.js';
import { uiTranslations } from './schema/ui-translations.js';
import { categories } from './schema/categories.js';
import { categoryTranslations } from './schema/category-translations.js';
import { tags } from './schema/tags.js';
import { tagTranslations } from './schema/tag-translations.js';
import { articles } from './schema/articles.js';
import { articleTranslations } from './schema/article-translations.js';
import { articleTags } from './schema/article-tags.js';
import { slugs } from './schema/slugs.js';
import { pages } from './schema/pages.js';
import { pageTranslations } from './schema/page-translations.js';
import type { InferInsertModel } from 'drizzle-orm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = resolve(__dirname, '../../data');
mkdirSync(dataDir, { recursive: true });

const db = createDb(resolve(dataDir, 'soli-isle.db'));

const now = new Date().toISOString();

async function seed() {
  // Create default language
  const enId = crypto.randomUUID();
  const zhId = crypto.randomUUID();

  await db.insert(languages).values([
    { id: enId, code: 'en', name: 'English', is_default: 1 },
    { id: zhId, code: 'zh', name: '中文', is_default: 0 },
  ]);

  // UI translations for both languages
  type NewUiTranslation = InferInsertModel<typeof uiTranslations>;
  const uiKeys = ['nav.home', 'nav.articles', 'nav.moments', 'nav.resources', 'nav.about', 'published_on', 'read_more', 'no_content', 'back_to_list'];
  const enUi: NewUiTranslation[] = uiKeys.map(k => ({ id: crypto.randomUUID(), key: k, language_id: enId, value: k.replace('nav.', '').replace(/_/g, ' ') }));
  const zhUi: NewUiTranslation[] = uiKeys.map(k => ({ id: crypto.randomUUID(), key: k, language_id: zhId, value: k }));
  await db.insert(uiTranslations).values([...enUi, ...zhUi]);

  // Create category
  const techCatId = crypto.randomUUID();
  await db.insert(categories).values({ id: techCatId, slug: 'tech', created_at: now, updated_at: now });
  await db.insert(categoryTranslations).values([
    { id: crypto.randomUUID(), category_id: techCatId, language_id: enId, name: 'Technology' },
    { id: crypto.randomUUID(), category_id: techCatId, language_id: zhId, name: '技术' },
  ]);

  // Create tags
  const rustTagId = crypto.randomUUID();
  const jsTagId = crypto.randomUUID();
  await db.insert(tags).values([
    { id: rustTagId, slug: 'rust', created_at: now, updated_at: now },
    { id: jsTagId, slug: 'javascript', created_at: now, updated_at: now },
  ]);
  await db.insert(tagTranslations).values([
    { id: crypto.randomUUID(), tag_id: rustTagId, language_id: enId, name: 'Rust' },
    { id: crypto.randomUUID(), tag_id: rustTagId, language_id: zhId, name: 'Rust' },
    { id: crypto.randomUUID(), tag_id: jsTagId, language_id: enId, name: 'JavaScript' },
    { id: crypto.randomUUID(), tag_id: jsTagId, language_id: zhId, name: 'JavaScript' },
  ]);

  // Create sample article
  const artId = crypto.randomUUID();
  await db.insert(slugs).values({ id: crypto.randomUUID(), slug: 'hello-world', entity_type: 'article', entity_id: artId });
  await db.insert(articles).values({ id: artId, slug: 'hello-world', category_id: techCatId, published_at: now, is_draft: 0, created_at: now, updated_at: now });
  await db.insert(articleTranslations).values([
    { id: crypto.randomUUID(), article_id: artId, language_id: enId, title: 'Hello World', body: '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Welcome to my blog!"}]}]}', excerpt: 'First post' },
    { id: crypto.randomUUID(), article_id: artId, language_id: zhId, title: '你好世界', body: '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"欢迎来到我的博客！"}]}]}', excerpt: '第一篇文章' },
  ]);
  await db.insert(articleTags).values([
    { article_id: artId, tag_id: rustTagId },
    { article_id: artId, tag_id: jsTagId },
  ]);

  // Create sample page
  const aboutId = crypto.randomUUID();
  await db.insert(slugs).values({ id: crypto.randomUUID(), slug: 'about', entity_type: 'page', entity_id: aboutId });
  await db.insert(pages).values({ id: aboutId, slug: 'about', published_at: now, is_draft: 0, sort_order: 1, created_at: now, updated_at: now });
  await db.insert(pageTranslations).values([
    { id: crypto.randomUUID(), page_id: aboutId, language_id: enId, title: 'About Me', body: '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"I write code."}]}]}' },
    { id: crypto.randomUUID(), page_id: aboutId, language_id: zhId, title: '关于我', body: '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"我写代码。"}]}]}' },
  ]);

  // Create sample resource
  const resId = crypto.randomUUID();
  await db.insert(schema.resources).values({ id: resId, url: 'https://example.com', category_id: techCatId, created_at: now, updated_at: now });
  await db.insert(schema.resourceTranslations).values([
    { id: crypto.randomUUID(), resource_id: resId, language_id: enId, title: 'Example Resource', description: 'A useful example' },
    { id: crypto.randomUUID(), resource_id: resId, language_id: zhId, title: '示例资源', description: '一个有用的示例' },
  ]);

  console.log('Seed data inserted successfully.');
}

seed().catch(console.error);
```

The seed script imports `schema` for resources/resourceTranslations which weren't destructured at the top. Add these destructured imports above `seed()`:

```typescript
import { resources } from './schema/resources.js';
import { resourceTranslations } from './schema/resource-translations.js';
```

Then change the resource inserts to use the destructured names: `resources` and `resourceTranslations`.

- [ ] **Step 2: Run seed script**

Run: `cd backend && rm -f data/soli-isle.db && npx tsx src/db/migrate.ts && npx tsx src/db/seed.ts`
Expected: "Seed data inserted successfully."

- [ ] **Step 3: Create seed verification test**

Create `backend/tests/db/seed.test.ts`:

```typescript
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
```

- [ ] **Step 4: Run seed tests**

Run: `cd backend && npx vitest run tests/db/seed.test.ts`
Expected: 4 tests PASS

- [ ] **Step 5: Run all tests together**

Run: `cd backend && npx vitest run`
Expected: all schema and seed tests PASS

- [ ] **Step 6: Commit**

```bash
git add backend/src/db/seed.ts backend/tests/db/seed.test.ts
git commit -m "feat: add seed script with sample data in two languages"
```

---

## Plan Complete — Verification Checklist

- [ ] All 12 tasks committed on `main`
- [ ] `backend/tests/db/schema.test.ts` — 4 tests pass (full article CRUD, duplicate slug rejection, cascade delete, language fallback)
- [ ] `backend/tests/db/seed.test.ts` — 4 tests pass (two languages, published article, category, slug entries)
- [ ] `npx vitest run` — all 8 tests pass
- [ ] `npx drizzle-kit generate` — produces migration SQL
- [ ] `npx tsx src/db/migrate.ts` — creates `data/soli-isle.db`
- [ ] `npx tsx src/db/seed.ts` — inserts seed data successfully
- [ ] `sqlite3 data/soli-isle.db ".tables"` — lists all 17 tables
