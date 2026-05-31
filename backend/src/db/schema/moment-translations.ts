import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { moments } from './moments.js';
import { languages } from './languages.js';

export const momentTranslations = sqliteTable('moment_translations', {
  id: text('id').primaryKey(),
  moment_id: text('moment_id').notNull().references(() => moments.id),
  language_id: text('language_id').notNull().references(() => languages.id),
  body: text('body').notNull(),
});
