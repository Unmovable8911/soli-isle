import { sqliteTable, text, primaryKey } from 'drizzle-orm/sqlite-core';
import { moments } from './moments.js';
import { tags } from './tags.js';

export const momentTags = sqliteTable('moment_tags', {
  moment_id: text('moment_id').notNull().references(() => moments.id),
  tag_id: text('tag_id').notNull().references(() => tags.id),
}, (table) => ({
  pk: primaryKey({ columns: [table.moment_id, table.tag_id] }),
}));
