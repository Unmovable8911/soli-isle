import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const moments = sqliteTable('moments', {
  id: text('id').primaryKey(),
  published_at: text('published_at').notNull(),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
});
