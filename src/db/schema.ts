import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { ASSET_FORMATS, ASSET_VARIANTS } from "@/domain/asset-address";

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

export const asset = sqliteTable(
  "asset",
  {
    id: text("id").primaryKey().notNull(),
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type").notNull(),
    byteSize: integer("byte_size").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    contentHash: text("content_hash").notNull(),
    uploadedAt: text("uploaded_at").notNull(),
  },
  (table) => [index("asset_uploaded_at_idx").on(table.uploadedAt)],
);

export const assetVariant = sqliteTable(
  "asset_variant",
  {
    assetId: text("asset_id")
      .notNull()
      .references(() => asset.id, { onDelete: "cascade" }),
    variant: text("variant", { enum: ASSET_VARIANTS }).notNull(),
    byteSize: integer("byte_size").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    format: text("format", { enum: ASSET_FORMATS }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.assetId, table.variant] })],
);

export const assetReference = sqliteTable(
  "asset_reference",
  {
    id: integer("id").primaryKey({ autoIncrement: true }).notNull(),
    assetId: text("asset_id")
      .notNull()
      .references(() => asset.id, { onDelete: "cascade" }),
    contentKind: text("content_kind").notNull(),
    contentId: text("content_id").notNull(),
  },
  (table) => [
    uniqueIndex("asset_reference_asset_content_idx").on(
      table.assetId,
      table.contentKind,
      table.contentId,
    ),
    index("asset_reference_content_idx").on(table.contentKind, table.contentId),
  ],
);
