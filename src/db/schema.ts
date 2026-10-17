import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const healthCheck = sqliteTable("health_check", {
  id: integer("id").primaryKey().notNull(),
  touchedAt: text("touched_at").notNull(),
});

export const session = sqliteTable("session", {
  id: text("id").primaryKey().notNull(),
  createdAt: text("created_at").notNull(),
  lastSeenAt: text("last_seen_at").notNull(),
  expiresAt: text("expires_at").notNull(),
});

export const authAuditLog = sqliteTable(
  "auth_audit_log",
  {
    id: integer("id").primaryKey({ autoIncrement: true }).notNull(),
    occurredAt: text("occurred_at").notNull(),
    kind: text("kind").notNull(),
    source: text("source"),
    detail: text("detail"),
  },
  (table) => [
    index("auth_audit_log_occurred_at_idx").on(table.occurredAt),
    index("auth_audit_log_source_occurred_at_idx").on(table.source, table.occurredAt),
  ],
);
