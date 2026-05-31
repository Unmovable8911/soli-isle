import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const categories = sqliteTable('categories', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
});
