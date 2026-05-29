import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { categories } from './categories.js';
import { languages } from './languages.js';

export const categoryTranslations = sqliteTable('category_translations', {
  id: text('id').primaryKey(),
  category_id: text('category_id').notNull().references(() => categories.id),
  language_id: text('language_id').notNull().references(() => languages.id),
  name: text('name').notNull(),
});
