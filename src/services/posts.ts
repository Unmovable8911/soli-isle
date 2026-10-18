import { and, asc, desc, eq, exists, inArray, isNotNull, lt, or, sql } from "drizzle-orm";

import { siteConfig, type Locale } from "@/config/site";
import type { DatabaseConnection } from "@/db/database";
import {
  asset,
  assetReference,
  assetVariant,
  post,
  postImage,
  postTag,
  postTranslation,
  tag,
} from "@/db/schema";
import { buildAssetAddress, type AssetFormat } from "@/domain/asset-address";
import type { Clock } from "@/domain/clock";
import { FEED_PAGE_SIZE, splitFeedPage, type FeedCursor } from "@/domain/feed-cursor";
import { pickLocalised } from "@/domain/localised";
import {
  publicationVisibility,
  type PublicationState,
  type PublicationVisibility,
} from "@/domain/publication";
import { EMPTY_DOCUMENT, isRichTextDocument } from "@/domain/rich-text";
import { generateUlid } from "@/domain/ulid";
import { syncAssetReferences, type AssetContext } from "./assets";
import { loadTagViews, type TagContext, type TagView } from "./tags";
import { visibleToReader } from "./visibility";

/**
 * Posts: the short, untitled sibling of Articles.
 *
 * They are deliberately *not* Articles with a flag. They share the domain
 * types (`Publication`, `Locale`, `Tag`) and the shared service functions
 * (the visibility predicate, the tag views) but keep their own tables —
 * the spec forbids a shared parent table — and they have no Slug, no
 * Category, no Revision and no URL of any kind.
 */
export const POST_CONTENT_KIND = "post";

export interface PostContext extends TagContext {
  database: DatabaseConnection;
  clock: Clock;
  assets: AssetContext;
}

export function createPostContext(
  database: DatabaseConnection,
  clock: Clock,
  assets: AssetContext,
): PostContext {
  return { database, clock, assets };
}

export class InvalidPostBodyError extends Error {
  constructor() {
    super("The post body must be a ProseMirror document");
    this.name = "InvalidPostBodyError";
  }
}

export interface PostTranslationSummary {
  locale: Locale;
  updatedAt: string;
  /** The version the composer must save against. */
  version: number;
}

export interface PostTranslationView extends PostTranslationSummary {
  bodyJson: string;
  bodyMarkdown: string;
  createdAt: string;
}

export interface PostImageRef {
  assetId: string;
  /** The uploaded file's name, used as the picture's alt text. */
  fileName: string;
  width: number;
  height: number;
}

export interface PostRecord<TTranslation extends PostTranslationSummary> {
  id: string;
  defaultLocale: Locale;
  publicationState: PublicationState;
  publishTime: string | null;
  visibility: PublicationVisibility;
  /** The ordered image set, as the composer arranged it. */
  images: PostImageRef[];
  tags: TagView[];
  translations: TTranslation[];
  createdAt: string;
  updatedAt: string;
}

export type PostSummary = PostRecord<PostTranslationSummary>;
export type PostDetail = PostRecord<PostTranslationView>;

export type PostMutationFailure =
  | {
      ok: false;
      reason:
        | "not-found"
        | "duplicate-locale"
        | "invalid-locale"
        | "invalid-publish-time"
        | "unknown-tag"
        | "unknown-asset"
        | "default-locale"
        | "last-translation"
        | "not-published"
        | "not-archived";
    }
  /** The save was derived from a version the server has moved past; nothing was written. */
  | { ok: false; reason: "stale-content"; current: PostTranslationView };

export type PostMutation = { ok: true; post: PostDetail } | PostMutationFailure;

export interface FeedImage {
  assetId: string;
  /** The cropped Feed cell: the `display` WebP variant. */
  src: string;
  /** The uploaded file, with its original ratio, which the lightbox shows. */
  original: string;
  width: number;
  height: number;
  alt: string;
}

export interface FeedTagRef {
  slug: string;
  name: string;
}

export interface FeedPost {
  id: string;
  /** Always present: only a Post with an arrived Publish Time is ever in the Feed. */
  publishTime: string;
  bodyJson: string;
  bodyMarkdown: string;
  images: FeedImage[];
  tags: FeedTagRef[];
}

export interface FeedPage {
  posts: FeedPost[];
  /** Null when nothing older exists, which is what hides the load-older control. */
  nextCursor: FeedCursor | null;
}

type PostRow = typeof post.$inferSelect;
type PostTranslationRow = typeof postTranslation.$inferSelect;

function toTranslationSummary(row: PostTranslationRow): PostTranslationSummary {
  return { locale: row.locale, updatedAt: row.updatedAt, version: row.version };
}

function toTranslationView(row: PostTranslationRow): PostTranslationView {
  return {
    locale: row.locale,
    updatedAt: row.updatedAt,
    version: row.version,
    bodyJson: row.bodyJson,
    bodyMarkdown: row.bodyMarkdown,
    createdAt: row.createdAt,
  };
}

function groupBy<T>(rows: readonly T[], key: (row: T) => string): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    const groupKey = key(row);
    const group = grouped.get(groupKey);
    if (group === undefined) {
      grouped.set(groupKey, [row]);
    } else {
      group.push(row);
    }
  }
  return grouped;
}

function localeOrder(locale: Locale): number {
  const index = siteConfig.locales.indexOf(locale);
  return index === -1 ? siteConfig.locales.length : index;
}

function loadRecords<TTranslation extends PostTranslationSummary>(
  ctx: PostContext,
  rows: readonly PostRow[],
  mapTranslation: (row: PostTranslationRow) => TTranslation,
): PostRecord<TTranslation>[] {
  if (rows.length === 0) {
    return [];
  }

  const db = ctx.database.db;
  const ids = rows.map((row) => row.id);
  const now = ctx.clock.now();

  const translationsByPost = groupBy(
    db.select().from(postTranslation).where(inArray(postTranslation.postId, ids)).all(),
    (row) => row.postId,
  );

  const imagesByPost = groupBy(
    db
      .select({
        postId: postImage.postId,
        assetId: postImage.assetId,
        position: postImage.position,
        fileName: asset.fileName,
        width: asset.width,
        height: asset.height,
      })
      .from(postImage)
      .innerJoin(asset, eq(asset.id, postImage.assetId))
      .where(inArray(postImage.postId, ids))
      .orderBy(asc(postImage.postId), asc(postImage.position))
      .all(),
    (row) => row.postId,
  );

  const tagIdsByPost = groupBy(
    db.select().from(postTag).where(inArray(postTag.postId, ids)).all(),
    (row) => row.postId,
  );
  const tagViews = loadTagViews(
    ctx,
    [...tagIdsByPost.values()].flat().map((row) => row.tagId),
  );

  return rows.map((row) => ({
    id: row.id,
    defaultLocale: row.defaultLocale,
    publicationState: row.publicationState,
    publishTime: row.publishTime,
    visibility: publicationVisibility(
      { state: row.publicationState, publishTime: row.publishTime },
      now,
    ),
    images: (imagesByPost.get(row.id) ?? []).map((image) => ({
      assetId: image.assetId,
      fileName: image.fileName,
      width: image.width,
      height: image.height,
    })),
    tags: (tagIdsByPost.get(row.id) ?? [])
      .map((link) => tagViews.get(link.tagId))
      .filter((view): view is TagView => view !== undefined)
      .sort((left, right) => left.slug.localeCompare(right.slug)),
    translations: (translationsByPost.get(row.id) ?? [])
      .sort((left, right) => localeOrder(left.locale) - localeOrder(right.locale))
      .map(mapTranslation),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }));
}

function loadPost(ctx: PostContext, postId: string): PostDetail | null {
  const row = ctx.database.db.select().from(post).where(eq(post.id, postId)).get();
  if (row === undefined) {
    return null;
  }
  const [detail] = loadRecords(ctx, [row], toTranslationView);
  return detail ?? null;
}

/**
 * The Post's Asset references are its attached images *and* whatever its body
 * happens to reference, written through the same scanner Articles use so the
 * Asset library cannot call an attached image an orphan.
 */
async function syncPostAssets(ctx: PostContext, postId: string): Promise<void> {
  const db = ctx.database.db;
  const translations = db
    .select({
      bodyJson: postTranslation.bodyJson,
      bodyMarkdown: postTranslation.bodyMarkdown,
    })
    .from(postTranslation)
    .where(eq(postTranslation.postId, postId))
    .all();
  const images = db
    .select({ assetId: postImage.assetId })
    .from(postImage)
    .where(eq(postImage.postId, postId))
    .all();

  const body = [
    ...translations.map((row) => `${row.bodyJson}\n${row.bodyMarkdown}`),
    ...images.map((row) => buildAssetAddress({ assetId: row.assetId, variant: "display", format: "webp" })),
  ].join("\n");

  await syncAssetReferences(ctx.assets, {
    contentKind: POST_CONTENT_KIND,
    contentId: postId,
    body,
  });
}

export async function createPostDraft(
  ctx: PostContext,
  input: { locale?: Locale; defaultLocale?: Locale; bodyJson?: string; bodyMarkdown?: string },
): Promise<PostDetail> {
  const locale = input.locale ?? siteConfig.defaultLocale;
  const defaultLocale = input.defaultLocale ?? locale;
  const bodyJson = input.bodyJson ?? EMPTY_DOCUMENT;
  if (!isRichTextDocument(bodyJson)) {
    throw new InvalidPostBodyError();
  }

  const now = ctx.clock.now();
  const createdAt = now.toISOString();
  const postId = generateUlid(now);

  ctx.database.db.transaction((tx) => {
    tx.insert(post)
      .values({
        id: postId,
        defaultLocale,
        publicationState: "draft",
        publishTime: null,
        createdAt,
        updatedAt: createdAt,
      })
      .run();
    tx.insert(postTranslation)
      .values({
        postId,
        locale,
        bodyJson,
        bodyMarkdown: input.bodyMarkdown ?? "",
        version: 1,
        createdAt,
        updatedAt: createdAt,
      })
      .run();
  });

  await syncPostAssets(ctx, postId);

  const detail = loadPost(ctx, postId);
  if (detail === null) {
    throw new Error("The post draft could not be read back after creation");
  }
  return detail;
}

export async function getPost(ctx: PostContext, postId: string): Promise<PostDetail | null> {
  return loadPost(ctx, postId);
}

export async function addPostTranslation(
  ctx: PostContext,
  input: { postId: string; locale: Locale; bodyJson?: string; bodyMarkdown?: string },
): Promise<PostMutation> {
  const db = ctx.database.db;
  const existing = db.select().from(post).where(eq(post.id, input.postId)).get();
  if (existing === undefined) {
    return { ok: false, reason: "not-found" };
  }

  const translation = db
    .select()
    .from(postTranslation)
    .where(
      and(eq(postTranslation.postId, input.postId), eq(postTranslation.locale, input.locale)),
    )
    .get();
  if (translation !== undefined) {
    return { ok: false, reason: "duplicate-locale" };
  }

  const bodyJson = input.bodyJson ?? EMPTY_DOCUMENT;
  if (!isRichTextDocument(bodyJson)) {
    throw new InvalidPostBodyError();
  }

  const now = ctx.clock.now().toISOString();
  db.transaction((tx) => {
    tx.insert(postTranslation)
      .values({
        postId: input.postId,
        locale: input.locale,
        bodyJson,
        bodyMarkdown: input.bodyMarkdown ?? "",
        version: 1,
        createdAt: now,
        updatedAt: now,
      })
      .run();
    tx.update(post).set({ updatedAt: now }).where(eq(post.id, input.postId)).run();
  });

  await syncPostAssets(ctx, input.postId);
  return finish(ctx, input.postId);
}

export async function savePostTranslation(
  ctx: PostContext,
  input: {
    postId: string;
    locale: Locale;
    /** The version this save was derived from; a different stored version refuses the write. */
    baseVersion: number;
    bodyJson?: string;
    bodyMarkdown?: string;
  },
): Promise<PostMutation> {
  const db = ctx.database.db;
  const existing = db
    .select()
    .from(postTranslation)
    .where(
      and(eq(postTranslation.postId, input.postId), eq(postTranslation.locale, input.locale)),
    )
    .get();
  if (existing === undefined) {
    return { ok: false, reason: "not-found" };
  }
  if (existing.version !== input.baseVersion) {
    return { ok: false, reason: "stale-content", current: toTranslationView(existing) };
  }
  if (input.bodyJson !== undefined && !isRichTextDocument(input.bodyJson)) {
    throw new InvalidPostBodyError();
  }

  const now = ctx.clock.now().toISOString();
  db.transaction((tx) => {
    tx.update(postTranslation)
      .set({
        bodyJson: input.bodyJson ?? existing.bodyJson,
        bodyMarkdown:
          input.bodyMarkdown ?? (input.bodyJson === undefined ? existing.bodyMarkdown : ""),
        version: existing.version + 1,
        updatedAt: now,
      })
      .where(
        and(eq(postTranslation.postId, input.postId), eq(postTranslation.locale, input.locale)),
      )
      .run();
    tx.update(post).set({ updatedAt: now }).where(eq(post.id, input.postId)).run();
  });

  await syncPostAssets(ctx, input.postId);
  return finish(ctx, input.postId);
}

/**
 * Removing one Locale version touches that row only: the Post, its images and
 * its Tags are the work's, not the version's. The two refusals are the rules
 * Content Fallback depends on — it needs a default version to show.
 */
export async function removePostTranslation(
  ctx: PostContext,
  input: { postId: string; locale: Locale },
): Promise<PostMutation> {
  const db = ctx.database.db;
  const existing = db.select().from(post).where(eq(post.id, input.postId)).get();
  if (existing === undefined) {
    return { ok: false, reason: "not-found" };
  }

  const translations = db
    .select({ locale: postTranslation.locale })
    .from(postTranslation)
    .where(eq(postTranslation.postId, input.postId))
    .all();
  if (!translations.some((row) => row.locale === input.locale)) {
    return { ok: false, reason: "not-found" };
  }
  if (input.locale === existing.defaultLocale) {
    return { ok: false, reason: "default-locale" };
  }
  if (translations.length <= 1) {
    return { ok: false, reason: "last-translation" };
  }

  const now = ctx.clock.now().toISOString();
  db.transaction((tx) => {
    tx.delete(postTranslation)
      .where(and(eq(postTranslation.postId, input.postId), eq(postTranslation.locale, input.locale)))
      .run();
    tx.update(post).set({ updatedAt: now }).where(eq(post.id, input.postId)).run();
  });

  await syncPostAssets(ctx, input.postId);
  return finish(ctx, input.postId);
}

/** The version Content Fallback shows; it must be one the Post really has. */
export async function setPostDefaultLocale(
  ctx: PostContext,
  input: { postId: string; defaultLocale: Locale },
): Promise<PostMutation> {
  const db = ctx.database.db;
  const existing = db.select().from(post).where(eq(post.id, input.postId)).get();
  if (existing === undefined) {
    return { ok: false, reason: "not-found" };
  }

  const translations = db
    .select({ locale: postTranslation.locale })
    .from(postTranslation)
    .where(eq(postTranslation.postId, input.postId))
    .all();
  if (!translations.some((row) => row.locale === input.defaultLocale)) {
    return { ok: false, reason: "invalid-locale" };
  }

  db.update(post)
    .set({ defaultLocale: input.defaultLocale, updatedAt: ctx.clock.now().toISOString() })
    .where(eq(post.id, input.postId))
    .run();

  return finish(ctx, input.postId);
}

/**
 * Attach, reorder and remove in one call: the composer hands over the whole
 * ordered set it is showing, and positions are rewritten as 0..n-1 so a reorder
 * cannot leave a gap or a duplicate behind.
 */
export async function setPostImages(
  ctx: PostContext,
  input: { postId: string; assetIds: readonly string[] },
): Promise<PostMutation> {
  const db = ctx.database.db;
  const existing = db.select({ id: post.id }).from(post).where(eq(post.id, input.postId)).get();
  if (existing === undefined) {
    return { ok: false, reason: "not-found" };
  }

  const assetIds = [...new Set(input.assetIds)];
  if (assetIds.length > 0) {
    const known = db
      .select({ id: asset.id })
      .from(asset)
      .where(inArray(asset.id, assetIds))
      .all();
    if (known.length !== assetIds.length) {
      return { ok: false, reason: "unknown-asset" };
    }
  }

  const now = ctx.clock.now().toISOString();
  db.transaction((tx) => {
    tx.delete(postImage).where(eq(postImage.postId, input.postId)).run();
    if (assetIds.length > 0) {
      tx.insert(postImage)
        .values(assetIds.map((assetId, position) => ({ postId: input.postId, assetId, position })))
        .run();
    }
    tx.update(post).set({ updatedAt: now }).where(eq(post.id, input.postId)).run();
  });

  await syncPostAssets(ctx, input.postId);
  return finish(ctx, input.postId);
}

/**
 * A Post is delete-only: it never had a URL, so unlike an Article it leaves no
 * Slug tombstone behind — only the Asset references have to go, which the
 * cascade on `post_image` and the explicit scan below take care of.
 */
export async function deletePostPermanently(
  ctx: PostContext,
  postId: string,
): Promise<{ deleted: true } | { deleted: false; reason: "not-found" }> {
  const db = ctx.database.db;
  const existing = db.select({ id: post.id }).from(post).where(eq(post.id, postId)).get();
  if (existing === undefined) {
    return { deleted: false, reason: "not-found" };
  }

  db.transaction((tx) => {
    tx.delete(post).where(eq(post.id, postId)).run();
    tx.delete(assetReference)
      .where(
        and(
          eq(assetReference.contentKind, POST_CONTENT_KIND),
          eq(assetReference.contentId, postId),
        ),
      )
      .run();
  });

  return { deleted: true };
}

export async function setPostTags(
  ctx: PostContext,
  input: { postId: string; tagIds: readonly string[] },
): Promise<PostMutation> {
  const db = ctx.database.db;
  const existing = db.select({ id: post.id }).from(post).where(eq(post.id, input.postId)).get();
  if (existing === undefined) {
    return { ok: false, reason: "not-found" };
  }

  const tagIds = [...new Set(input.tagIds)];
  const known = loadTagViews(ctx, tagIds);
  if (tagIds.some((tagId) => !known.has(tagId))) {
    return { ok: false, reason: "unknown-tag" };
  }

  const now = ctx.clock.now().toISOString();
  db.transaction((tx) => {
    tx.delete(postTag).where(eq(postTag.postId, input.postId)).run();
    if (tagIds.length > 0) {
      tx.insert(postTag)
        .values(tagIds.map((tagId) => ({ postId: input.postId, tagId })))
        .run();
    }
    tx.update(post).set({ updatedAt: now }).where(eq(post.id, input.postId)).run();
  });

  return finish(ctx, input.postId);
}

/**
 * Publishing a Post shares its meaning with publishing an Article: a Publish
 * Time in the future is a scheduled Post, judged by the site time zone because
 * the boundary converts the wall-clock value before it gets here.
 */
export async function publishPost(
  ctx: PostContext,
  input: { postId: string; publishTime?: string | null },
): Promise<PostMutation> {
  const db = ctx.database.db;
  const existing = db.select().from(post).where(eq(post.id, input.postId)).get();
  if (existing === undefined) {
    return { ok: false, reason: "not-found" };
  }

  let publishTime: string;
  if (input.publishTime === undefined) {
    publishTime = existing.publishTime ?? ctx.clock.now().toISOString();
  } else if (input.publishTime === null) {
    publishTime = ctx.clock.now().toISOString();
  } else {
    const parsed = Date.parse(input.publishTime);
    if (Number.isNaN(parsed)) {
      return { ok: false, reason: "invalid-publish-time" };
    }
    publishTime = new Date(parsed).toISOString();
  }

  db.update(post)
    .set({
      publicationState: "published",
      publishTime,
      updatedAt: ctx.clock.now().toISOString(),
    })
    .where(eq(post.id, input.postId))
    .run();

  return finish(ctx, input.postId);
}

export async function archivePost(
  ctx: PostContext,
  input: { postId: string },
): Promise<PostMutation> {
  const db = ctx.database.db;
  const existing = db.select().from(post).where(eq(post.id, input.postId)).get();
  if (existing === undefined) {
    return { ok: false, reason: "not-found" };
  }
  if (existing.publicationState !== "published") {
    return { ok: false, reason: "not-published" };
  }

  db.update(post)
    .set({ publicationState: "archived", updatedAt: ctx.clock.now().toISOString() })
    .where(eq(post.id, input.postId))
    .run();

  return finish(ctx, input.postId);
}

export async function unarchivePost(
  ctx: PostContext,
  input: { postId: string },
): Promise<PostMutation> {
  const db = ctx.database.db;
  const existing = db.select().from(post).where(eq(post.id, input.postId)).get();
  if (existing === undefined) {
    return { ok: false, reason: "not-found" };
  }
  if (existing.publicationState !== "archived") {
    return { ok: false, reason: "not-archived" };
  }

  db.update(post)
    .set({ publicationState: "published", updatedAt: ctx.clock.now().toISOString() })
    .where(eq(post.id, input.postId))
    .run();

  return finish(ctx, input.postId);
}

/**
 * One page of the Feed, newest first.
 *
 * Locale-strict by construction: the join is on a Post Translation in the
 * requested Locale, so a Post the Reader could only see through Content
 * Fallback is not in this Feed at all — the fallback rule does not apply here.
 * The cursor is the (Publish Time, id) of the last card the Reader already has,
 * which keeps the order stable even when two Posts share a Publish Time.
 */
export async function readFeedPage(
  ctx: PostContext,
  input: {
    locale: Locale;
    /** Only Posts carrying this Tag, which is what a tapped Tag asks for. */
    tagSlug?: string | null;
    cursor?: FeedCursor | null;
    pageSize?: number;
  },
): Promise<FeedPage> {
  const db = ctx.database.db;
  const pageSize = input.pageSize ?? FEED_PAGE_SIZE;
  const nowIso = ctx.clock.now().toISOString();

  const conditions = [
    visibleToReader(post.publicationState, post.publishTime, nowIso),
    isNotNull(post.publishTime),
  ];
  if (input.tagSlug !== undefined && input.tagSlug !== null && input.tagSlug.length > 0) {
    const tagSlug = input.tagSlug;
    conditions.push(
      exists(
        db
          .select({ found: sql`1` })
          .from(postTag)
          .innerJoin(tag, eq(tag.id, postTag.tagId))
          .where(and(eq(postTag.postId, post.id), eq(tag.slug, tagSlug))),
      ),
    );
  }
  const cursor = input.cursor ?? null;
  if (cursor !== null) {
    const older = or(
      lt(post.publishTime, cursor.publishTime),
      and(eq(post.publishTime, cursor.publishTime), lt(post.id, cursor.id)),
    );
    if (older !== undefined) {
      conditions.push(older);
    }
  }

  const rows = db
    .select({
      id: post.id,
      publishTime: post.publishTime,
      bodyJson: postTranslation.bodyJson,
      bodyMarkdown: postTranslation.bodyMarkdown,
    })
    .from(post)
    .innerJoin(
      postTranslation,
      and(eq(postTranslation.postId, post.id), eq(postTranslation.locale, input.locale)),
    )
    .where(and(...conditions))
    .orderBy(desc(post.publishTime), desc(post.id))
    .limit(pageSize + 1)
    .all();

  const { page, hasMore } = splitFeedPage(rows, pageSize);
  const ids = page.map((row) => row.id);
  if (ids.length === 0) {
    return { posts: [], nextCursor: null };
  }

  const tagsByPost = new Map<string, FeedTagRef[]>();
  const tagLinks = db
    .select({ postId: postTag.postId, tagId: postTag.tagId })
    .from(postTag)
    .where(inArray(postTag.postId, ids))
    .all();
  const tagViews = loadTagViews(
    ctx,
    tagLinks.map((link) => link.tagId),
  );
  for (const link of tagLinks) {
    const view = tagViews.get(link.tagId);
    if (view === undefined) {
      continue;
    }
    const list = tagsByPost.get(link.postId) ?? [];
    list.push({ slug: view.slug, name: pickLocalised(view.names, input.locale, view.slug) });
    tagsByPost.set(link.postId, list);
  }
  for (const list of tagsByPost.values()) {
    list.sort((left, right) => left.slug.localeCompare(right.slug));
  }

  const imagesByPost = new Map<string, FeedImage[]>();
  const imageRows = db
    .select({
      postId: postImage.postId,
      assetId: postImage.assetId,
      fileName: asset.fileName,
      width: asset.width,
      height: asset.height,
    })
    .from(postImage)
    .innerJoin(asset, eq(asset.id, postImage.assetId))
    .where(inArray(postImage.postId, ids))
    .orderBy(asc(postImage.postId), asc(postImage.position))
    .all();
  const originals = new Map(
    (imageRows.length === 0
      ? []
      : db
          .select({
            assetId: assetVariant.assetId,
            format: assetVariant.format,
            width: assetVariant.width,
            height: assetVariant.height,
          })
          .from(assetVariant)
          .where(
            and(
              eq(assetVariant.variant, "original"),
              inArray(
                assetVariant.assetId,
                imageRows.map((row) => row.assetId),
              ),
            ),
          )
          .all()
    ).map((row) => [row.assetId, row]),
  );
  for (const row of imageRows) {
    const original = originals.get(row.assetId);
    const list = imagesByPost.get(row.postId) ?? [];
    list.push({
      assetId: row.assetId,
      src: buildAssetAddress({ assetId: row.assetId, variant: "display", format: "webp" }),
      original:
        original === undefined
          ? buildAssetAddress({ assetId: row.assetId, variant: "display", format: "webp" })
          : buildAssetAddress({
              assetId: row.assetId,
              variant: "original",
              format: original.format as AssetFormat,
            }),
      width: original?.width ?? row.width,
      height: original?.height ?? row.height,
      alt: row.fileName,
    });
    imagesByPost.set(row.postId, list);
  }

  const posts: FeedPost[] = [];
  for (const row of page) {
    // The query already requires a Publish Time; skipping an impossible row is
    // safer than throwing on one.
    if (row.publishTime === null) {
      continue;
    }
    posts.push({
      id: row.id,
      publishTime: row.publishTime,
      bodyJson: row.bodyJson,
      bodyMarkdown: row.bodyMarkdown,
      images: imagesByPost.get(row.id) ?? [],
      tags: tagsByPost.get(row.id) ?? [],
    });
  }

  const last = page[page.length - 1];
  return {
    posts,
    nextCursor:
      hasMore && last !== undefined && last.publishTime !== null
        ? { publishTime: last.publishTime, id: last.id }
        : null,
  };
}

function finish(ctx: PostContext, postId: string): PostMutation {
  const detail = loadPost(ctx, postId);
  if (detail === null) {
    return { ok: false, reason: "not-found" };
  }
  return { ok: true, post: detail };
}

/** The Author console list: every Post, whatever its state, newest edit first. */
export async function listPosts(ctx: PostContext): Promise<PostSummary[]> {
  const rows = ctx.database.db
    .select()
    .from(post)
    .orderBy(desc(post.updatedAt), desc(post.id))
    .all();

  return loadRecords(ctx, rows, toTranslationSummary);
}
