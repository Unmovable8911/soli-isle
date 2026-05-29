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
