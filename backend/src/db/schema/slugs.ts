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
