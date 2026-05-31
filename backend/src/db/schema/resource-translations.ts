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
