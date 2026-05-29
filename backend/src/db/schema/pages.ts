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
