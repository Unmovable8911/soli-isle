import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const socialLinks = sqliteTable('social_links', {
  id: text('id').primaryKey(),
  platform: text('platform').notNull().unique(),
  url: text('url').notNull(),
  is_enabled: integer('is_enabled').notNull().default(1),
  sort_order: integer('sort_order').notNull().default(0),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
});
