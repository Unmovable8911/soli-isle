import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { articles } from './articles.js';
import { languages } from './languages.js';

export const articleTranslations = sqliteTable('article_translations', {
  id: text('id').primaryKey(),
  article_id: text('article_id').notNull().references(() => articles.id),
  language_id: text('language_id').notNull().references(() => languages.id),
  title: text('title').notNull(),
  body: text('body').notNull(),
  excerpt: text('excerpt'),
});
