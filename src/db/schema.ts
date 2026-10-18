import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
  type AnySQLiteColumn,
} from "drizzle-orm/sqlite-core";
import { siteConfig } from "@/config/site";
import { ASSET_FORMATS, ASSET_VARIANTS } from "@/domain/asset-address";
import { PUBLICATION_STATES } from "@/domain/publication";
import { REVISION_KINDS } from "@/domain/revision";

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

export const article = sqliteTable(
  "article",
  {
    id: text("id").primaryKey().notNull(),
    defaultLocale: text("default_locale", { enum: siteConfig.locales }).notNull(),
    publicationState: text("publication_state", { enum: PUBLICATION_STATES }).notNull(),
    publishTime: text("publish_time"),
    categoryId: text("category_id").references((): AnySQLiteColumn => category.id, {
      onDelete: "set null",
    }),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("article_publication_state_idx").on(table.publicationState),
    index("article_publish_time_idx").on(table.publishTime),
    index("article_category_idx").on(table.categoryId),
  ],
);

export const articleTranslation = sqliteTable(
  "article_translation",
  {
    articleId: text("article_id")
      .notNull()
      .references(() => article.id, { onDelete: "cascade" }),
    locale: text("locale", { enum: siteConfig.locales }).notNull(),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    bodyJson: text("body_json").notNull(),
    bodyMarkdown: text("body_markdown").notNull(),
    /** Bumped by every write; the editor saves against the version it read. */
    version: integer("version").notNull().default(1),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [primaryKey({ columns: [table.articleId, table.locale] })],
);

export const category = sqliteTable(
  "category",
  {
    id: text("id").primaryKey().notNull(),
    parentId: text("parent_id").references((): AnySQLiteColumn => category.id, {
      onDelete: "restrict",
    }),
    /** The Category's own locale-neutral segment. */
    slug: text("slug").notNull(),
    /** Locale-neutral slug path built from the ancestors; unique in the tree. */
    path: text("path").notNull(),
    position: integer("position").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("category_path_idx").on(table.path),
    index("category_parent_idx").on(table.parentId),
  ],
);

export const categoryTranslation = sqliteTable(
  "category_translation",
  {
    categoryId: text("category_id")
      .notNull()
      .references(() => category.id, { onDelete: "cascade" }),
    locale: text("locale", { enum: siteConfig.locales }).notNull(),
    name: text("name").notNull(),
  },
  (table) => [primaryKey({ columns: [table.categoryId, table.locale] })],
);

export const tag = sqliteTable(
  "tag",
  {
    id: text("id").primaryKey().notNull(),
    slug: text("slug").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [uniqueIndex("tag_slug_idx").on(table.slug)],
);

export const tagTranslation = sqliteTable(
  "tag_translation",
  {
    tagId: text("tag_id")
      .notNull()
      .references(() => tag.id, { onDelete: "cascade" }),
    locale: text("locale", { enum: siteConfig.locales }).notNull(),
    name: text("name").notNull(),
  },
  (table) => [primaryKey({ columns: [table.tagId, table.locale] })],
);

export const articleTag = sqliteTable(
  "article_tag",
  {
    articleId: text("article_id")
      .notNull()
      .references(() => article.id, { onDelete: "cascade" }),
    tagId: text("tag_id")
      .notNull()
      .references(() => tag.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.articleId, table.tagId] }),
    index("article_tag_tag_idx").on(table.tagId),
  ],
);

export const articleSlug = sqliteTable(
  "article_slug",
  {
    /** The current Slug of an Article. A null articleId is the 410 tombstone. */
    slug: text("slug").primaryKey().notNull(),
    articleId: text("article_id").references(() => article.id, { onDelete: "set null" }),
    assignedAt: text("assigned_at").notNull(),
  },
  (table) => [uniqueIndex("article_slug_article_idx").on(table.articleId)],
);

export const articleSlugHistory = sqliteTable(
  "article_slug_history",
  {
    /** A Slug the Article used to answer on. A null articleId is the 410 tombstone. */
    slug: text("slug").primaryKey().notNull(),
    articleId: text("article_id").references(() => article.id, { onDelete: "set null" }),
    replacedAt: text("replaced_at").notNull(),
  },
  (table) => [index("article_slug_history_article_idx").on(table.articleId)],
);

export const articleRevision = sqliteTable(
  "article_revision",
  {
    id: text("id").primaryKey().notNull(),
    articleId: text("article_id")
      .notNull()
      .references(() => article.id, { onDelete: "cascade" }),
    locale: text("locale", { enum: siteConfig.locales }).notNull(),
    kind: text("kind", { enum: REVISION_KINDS }).notNull(),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    bodyJson: text("body_json").notNull(),
    bodyMarkdown: text("body_markdown").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("article_revision_article_locale_created_idx").on(
      table.articleId,
      table.locale,
      table.createdAt,
    ),
  ],
);
