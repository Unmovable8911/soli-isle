import { sqliteTable, text, primaryKey } from 'drizzle-orm/sqlite-core';
import { articles } from './articles.js';
import { tags } from './tags.js';

export const articleTags = sqliteTable('article_tags', {
  article_id: text('article_id').notNull().references(() => articles.id),
  tag_id: text('tag_id').notNull().references(() => tags.id),
}, (table) => [
  primaryKey({ columns: [table.article_id, table.tag_id] }),
]);
