import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { pages } from './pages.js';
import { languages } from './languages.js';

export const pageTranslations = sqliteTable('page_translations', {
  id: text('id').primaryKey(),
  page_id: text('page_id').notNull().references(() => pages.id),
  language_id: text('language_id').notNull().references(() => languages.id),
  title: text('title').notNull(),
  body: text('body').notNull(),
});
