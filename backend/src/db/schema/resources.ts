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
