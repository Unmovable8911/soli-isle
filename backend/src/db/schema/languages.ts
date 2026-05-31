import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const languages = sqliteTable('languages', {
  id: text('id').primaryKey(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  is_default: integer('is_default').notNull().default(0),
});
