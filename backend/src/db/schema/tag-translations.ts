import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { tags } from './tags.js';
import { languages } from './languages.js';

export const tagTranslations = sqliteTable('tag_translations', {
  id: text('id').primaryKey(),
  tag_id: text('tag_id').notNull().references(() => tags.id),
  language_id: text('language_id').notNull().references(() => languages.id),
  name: text('name').notNull(),
});
