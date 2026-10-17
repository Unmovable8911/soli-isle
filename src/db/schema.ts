import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const healthCheck = sqliteTable("health_check", {
  id: integer("id").primaryKey().notNull(),
  touchedAt: text("touched_at").notNull(),
});
