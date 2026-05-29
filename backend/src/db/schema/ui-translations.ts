import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { languages } from './languages.js';

export const uiTranslations = sqliteTable('ui_translations', {
  id: text('id').primaryKey(),
  key: text('key').notNull(),
  language_id: text('language_id').notNull().references(() => languages.id),
  value: text('value').notNull(),
});
