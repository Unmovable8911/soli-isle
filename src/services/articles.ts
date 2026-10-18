import { and, asc, desc, eq, inArray, isNull, lte, or } from "drizzle-orm";

import { articleConfig } from "@/config/article";
import { siteConfig, type Locale } from "@/config/site";
import type { DatabaseConnection } from "@/db/database";
import {
  article,
  articleRevision,
  articleSlug,
  articleSlugHistory,
  articleTag,
  articleTranslation,
  assetReference,
} from "@/db/schema";
import type { Clock } from "@/domain/clock";
import { EMPTY_DOCUMENT, isRichTextDocument } from "@/domain/rich-text";
import {
  isIndexable,
  isReadableByUrl,
  publicationVisibility,
  type PublicationState,
  type PublicationVisibility,
} from "@/domain/publication";
import {
  selectPrunableRevisions,
  shouldCaptureAutomaticRevision,
  type RevisionKind,
} from "@/domain/revision";
import { isSafeSlug, normaliseSlug, uniqueSlug } from "@/domain/slug";
import { selectTranslation } from "@/domain/translation-coverage";
import { generateUlid } from "@/domain/ulid";
import { deriveMarkdown } from "@/editor/markdown";
import type { AssetContext } from "./assets";
import { loadCategoryViews, type CategoryContext, type CategoryView } from "./categories";
import {
  finishMutation,
  groupBy,
  InvalidArticleBodyError,
  localeOrder,
  syncTranslationAssets,
} from "./content";
import { loadTagViews, type TagContext, type TagView } from "./tags";

export const ARTICLE_CONTENT_KIND = "article";

export interface ArticleContext extends CategoryContext, TagContext {
  assets: AssetContext;
}

export function createArticleContext(
  database: DatabaseConnection,
  clock: Clock,
  assets: AssetContext,
): ArticleContext {
  return { database, clock, assets };
}

export { InvalidArticleBodyError } from "./content";

export interface ArticleTranslationSummary {
  locale: Locale;
  title: string;
  updatedAt: string;
  /** The version an editor must save against. */
  version: number;
}

export interface ArticleTranslationView extends ArticleTranslationSummary {
  summary: string;
  bodyJson: string;
  /** Derived from `bodyJson` when this service writes the row; never an input. */
  bodyMarkdown: string;
  createdAt: string;
}

export interface ArticleRecord<TTranslation extends ArticleTranslationSummary> {
  id: string;
  slug: string;
  defaultLocale: Locale;
  publicationState: PublicationState;
  publishTime: string | null;
  visibility: PublicationVisibility;
  categoryId: string | null;
  category: CategoryView | null;
  tags: TagView[];
  translations: TTranslation[];
  createdAt: string;
  updatedAt: string;
}

export type ArticleSummary = ArticleRecord<ArticleTranslationSummary>;
export type ArticleDetail = ArticleRecord<ArticleTranslationView>;

export interface ArticleRevisionView {
  id: string;
  articleId: string;
  locale: Locale;
  kind: RevisionKind;
  title: string;
  summary: string;
  bodyJson: string;
  bodyMarkdown: string;
  createdAt: string;
}

export type ArticleMutationFailure =
  | {
      ok: false;
      reason:
        | "not-found"
        | "duplicate-locale"
        | "duplicate-slug"
        | "invalid-slug"
        | "invalid-locale"
        | "invalid-publish-time"
        | "unknown-category"
        | "unknown-tag"
        | "default-locale"
        | "last-translation"
        | "not-published"
        | "not-archived";
    }
  /**
   * The save was derived from a version the server has moved past. Nothing was
   * written; `current` is the server copy the editor must show the Author.
   */
  | { ok: false; reason: "stale-content"; current: ArticleTranslationView };

export type ArticleMutation = { ok: true; article: ArticleDetail } | ArticleMutationFailure;

export type AutomaticRevisionOutcome =
  | { ok: true; created: false }
  | { ok: true; created: true; revision: ArticleRevisionView | null }
  | { ok: false; reason: "not-found" };

export type SlugResolution =
  | { kind: "found"; article: ArticleDetail; slugKind: "current" | "historical" }
  | { kind: "permanently-removed" }
  | { kind: "not-found" };

export type ReadableArticle =
  | {
      kind: "found";
      article: ArticleDetail;
      translation: ArticleTranslationView;
      /** True when the requested Locale has no version and the default one is shown. */
      fellBack: boolean;
      indexable: boolean;
    }
  | { kind: "permanently-removed" }
  | { kind: "not-found" };

type ArticleRow = typeof article.$inferSelect;
type ArticleTranslationRow = typeof articleTranslation.$inferSelect;
type ArticleRevisionRow = typeof articleRevision.$inferSelect;

function toTranslationSummary(row: ArticleTranslationRow): ArticleTranslationSummary {
  return { locale: row.locale, title: row.title, updatedAt: row.updatedAt, version: row.version };
}

function toTranslationView(row: ArticleTranslationRow): ArticleTranslationView {
  return {
    locale: row.locale,
    title: row.title,
    updatedAt: row.updatedAt,
    version: row.version,
    summary: row.summary,
    bodyJson: row.bodyJson,
    bodyMarkdown: row.bodyMarkdown,
    createdAt: row.createdAt,
  };
}

function toRevisionView(row: ArticleRevisionRow): ArticleRevisionView {
  return {
    id: row.id,
    articleId: row.articleId,
    locale: row.locale,
    kind: row.kind,
    title: row.title,
    summary: row.summary,
    bodyJson: row.bodyJson,
    bodyMarkdown: row.bodyMarkdown,
    createdAt: row.createdAt,
  };
}

function loadRecords<TTranslation extends ArticleTranslationSummary>(
  ctx: ArticleContext,
  rows: readonly ArticleRow[],
  mapTranslation: (row: ArticleTranslationRow) => TTranslation,
): ArticleRecord<TTranslation>[] {
  if (rows.length === 0) {
    return [];
  }

  const db = ctx.database.db;
  const ids = rows.map((row) => row.id);
  const now = ctx.clock.now();

  const slugByArticle = new Map(
    db
      .select({ articleId: articleSlug.articleId, slug: articleSlug.slug })
      .from(articleSlug)
      .where(inArray(articleSlug.articleId, ids))
      .all()
      .flatMap((row) => (row.articleId === null ? [] : [[row.articleId, row.slug] as const])),
  );

  const translationsByArticle = groupBy(
    db
      .select()
      .from(articleTranslation)
      .where(inArray(articleTranslation.articleId, ids))
      .all(),
    (row) => row.articleId,
  );

  const tagIdsByArticle = groupBy(
    db.select().from(articleTag).where(inArray(articleTag.articleId, ids)).all(),
    (row) => row.articleId,
  );
  const tagViews = loadTagViews(
    ctx,
    [...tagIdsByArticle.values()].flat().map((row) => row.tagId),
  );
  const categoryViews = loadCategoryViews(
    ctx,
    rows.flatMap((row) => (row.categoryId === null ? [] : [row.categoryId])),
  );

  return rows.map((row) => {
    const tags = (tagIdsByArticle.get(row.id) ?? [])
      .map((link) => tagViews.get(link.tagId))
      .filter((view): view is TagView => view !== undefined)
      .sort((left, right) => left.slug.localeCompare(right.slug));

    return {
      id: row.id,
      slug: slugByArticle.get(row.id) ?? "",
      defaultLocale: row.defaultLocale,
      publicationState: row.publicationState,
      publishTime: row.publishTime,
      visibility: publicationVisibility(
        { state: row.publicationState, publishTime: row.publishTime },
        now,
      ),
      categoryId: row.categoryId,
      category: row.categoryId === null ? null : (categoryViews.get(row.categoryId) ?? null),
      tags,
      translations: (translationsByArticle.get(row.id) ?? [])
        .sort((left, right) => localeOrder(left.locale) - localeOrder(right.locale))
        .map(mapTranslation),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  });
}

function loadArticle(ctx: ArticleContext, articleId: string): ArticleDetail | null {
  const row = ctx.database.db.select().from(article).where(eq(article.id, articleId)).get();
  if (row === undefined) {
    return null;
  }
  const [detail] = loadRecords(ctx, [row], toTranslationView);
  return detail ?? null;
}

async function syncArticleAssets(ctx: ArticleContext, articleId: string): Promise<void> {
  const translations = ctx.database.db
    .select({
      bodyJson: articleTranslation.bodyJson,
      bodyMarkdown: articleTranslation.bodyMarkdown,
    })
    .from(articleTranslation)
    .where(eq(articleTranslation.articleId, articleId))
    .all();

  await syncTranslationAssets(ctx, {
    contentKind: ARTICLE_CONTENT_KIND,
    contentId: articleId,
    translations,
  });
}

function isSlugTaken(ctx: ArticleContext, slug: string, articleId: string | null): boolean {
  const db = ctx.database.db;
  const current = db.select().from(articleSlug).where(eq(articleSlug.slug, slug)).get();
  if (current !== undefined) {
    return current.articleId !== articleId;
  }
  const historical = db
    .select()
    .from(articleSlugHistory)
    .where(eq(articleSlugHistory.slug, slug))
    .get();
  if (historical !== undefined) {
    return historical.articleId !== articleId;
  }
  return false;
}

function nextSlug(ctx: ArticleContext, base: string): string {
  return uniqueSlug(base, (candidate) => isSlugTaken(ctx, candidate, null));
}

export async function createArticleDraft(
  ctx: ArticleContext,
  input: {
    title: string;
    locale?: Locale;
    defaultLocale?: Locale;
    slug?: string;
    summary?: string;
    bodyJson?: string;
  },
): Promise<ArticleDetail> {
  const locale = input.locale ?? siteConfig.defaultLocale;
  const defaultLocale = input.defaultLocale ?? locale;
  const bodyJson = input.bodyJson ?? EMPTY_DOCUMENT;
  if (!isRichTextDocument(bodyJson)) {
    throw new InvalidArticleBodyError();
  }

  const now = ctx.clock.now();
  const createdAt = now.toISOString();
  const articleId = generateUlid(now);
  const slug = nextSlug(ctx, normaliseSlug(input.slug ?? input.title));

  ctx.database.db.transaction((tx) => {
    tx.insert(article)
      .values({
        id: articleId,
        defaultLocale,
        publicationState: "draft",
        publishTime: null,
        categoryId: null,
        createdAt,
        updatedAt: createdAt,
      })
      .run();
    tx.insert(articleTranslation)
      .values({
        articleId,
        locale,
        title: input.title.trim(),
        summary: input.summary ?? "",
        bodyJson,
        bodyMarkdown: deriveMarkdown(bodyJson),
        version: 1,
        createdAt,
        updatedAt: createdAt,
      })
      .run();
    tx.insert(articleSlug).values({ slug, articleId, assignedAt: createdAt }).run();
  });

  await syncArticleAssets(ctx, articleId);

  const detail = loadArticle(ctx, articleId);
  if (detail === null) {
    throw new Error("The article draft could not be read back after creation");
  }
  return detail;
}

export async function getArticle(
  ctx: ArticleContext,
  articleId: string,
): Promise<ArticleDetail | null> {
  return loadArticle(ctx, articleId);
}

export async function listArticles(ctx: ArticleContext): Promise<ArticleSummary[]> {
  const rows = ctx.database.db
    .select()
    .from(article)
    .orderBy(desc(article.updatedAt), desc(article.id))
    .all();

  return loadRecords(ctx, rows, toTranslationSummary);
}

/** What the public surfaces may list: visible to Readers, newest Publish Time first. */
export async function listPublishedArticles(ctx: ArticleContext): Promise<ArticleSummary[]> {
  const nowIso = ctx.clock.now().toISOString();
  const rows = ctx.database.db
    .select()
    .from(article)
    .where(
      and(
        eq(article.publicationState, "published"),
        or(isNull(article.publishTime), lte(article.publishTime, nowIso)),
      ),
    )
    .orderBy(desc(article.publishTime), desc(article.id))
    .all();

  return loadRecords(ctx, rows, toTranslationSummary);
}

export async function addArticleTranslation(
  ctx: ArticleContext,
  input: {
    articleId: string;
    locale: Locale;
    title?: string;
    summary?: string;
    bodyJson?: string;
  },
): Promise<ArticleMutation> {
  const db = ctx.database.db;
  const existing = db.select().from(article).where(eq(article.id, input.articleId)).get();
  if (existing === undefined) {
    return { ok: false, reason: "not-found" };
  }

  const translation = db
    .select()
    .from(articleTranslation)
    .where(
      and(
        eq(articleTranslation.articleId, input.articleId),
        eq(articleTranslation.locale, input.locale),
      ),
    )
    .get();
  if (translation !== undefined) {
    return { ok: false, reason: "duplicate-locale" };
  }

  const bodyJson = input.bodyJson ?? EMPTY_DOCUMENT;
  if (!isRichTextDocument(bodyJson)) {
    throw new InvalidArticleBodyError();
  }

  const now = ctx.clock.now().toISOString();
  db.transaction((tx) => {
    tx.insert(articleTranslation)
      .values({
        articleId: input.articleId,
        locale: input.locale,
        title: (input.title ?? "").trim(),
        summary: input.summary ?? "",
        bodyJson,
        bodyMarkdown: deriveMarkdown(bodyJson),
        version: 1,
        createdAt: now,
        updatedAt: now,
      })
      .run();
    tx.update(article).set({ updatedAt: now }).where(eq(article.id, input.articleId)).run();
  });

  await syncArticleAssets(ctx, input.articleId);
  return finishMutation("article", () => loadArticle(ctx, input.articleId));
}

export async function saveArticleTranslation(
  ctx: ArticleContext,
  input: {
    articleId: string;
    locale: Locale;
    /** The version this save was derived from; a different stored version refuses the write. */
    baseVersion: number;
    title?: string;
    summary?: string;
    bodyJson?: string;
  },
): Promise<ArticleMutation> {
  const db = ctx.database.db;
  const existing = db
    .select()
    .from(articleTranslation)
    .where(
      and(
        eq(articleTranslation.articleId, input.articleId),
        eq(articleTranslation.locale, input.locale),
      ),
    )
    .get();
  if (existing === undefined) {
    return { ok: false, reason: "not-found" };
  }
  if (existing.version !== input.baseVersion) {
    return { ok: false, reason: "stale-content", current: toTranslationView(existing) };
  }
  if (input.bodyJson !== undefined && !isRichTextDocument(input.bodyJson)) {
    throw new InvalidArticleBodyError();
  }

  const now = ctx.clock.now().toISOString();
  const bodyJson = input.bodyJson ?? existing.bodyJson;

  db.transaction((tx) => {
    tx.update(articleTranslation)
      .set({
        title: input.title === undefined ? existing.title : input.title.trim(),
        summary: input.summary ?? existing.summary,
        bodyJson,
        bodyMarkdown: input.bodyJson === undefined ? existing.bodyMarkdown : deriveMarkdown(bodyJson),
        version: existing.version + 1,
        updatedAt: now,
      })
      .where(
        and(
          eq(articleTranslation.articleId, input.articleId),
          eq(articleTranslation.locale, input.locale),
        ),
      )
      .run();
    tx.update(article).set({ updatedAt: now }).where(eq(article.id, input.articleId)).run();
  });

  await syncArticleAssets(ctx, input.articleId);
  return finishMutation("article", () => loadArticle(ctx, input.articleId));
}

export async function removeArticleTranslation(
  ctx: ArticleContext,
  input: { articleId: string; locale: Locale },
): Promise<ArticleMutation> {
  const db = ctx.database.db;
  const existing = db.select().from(article).where(eq(article.id, input.articleId)).get();
  if (existing === undefined) {
    return { ok: false, reason: "not-found" };
  }

  const translations = db
    .select({ locale: articleTranslation.locale })
    .from(articleTranslation)
    .where(eq(articleTranslation.articleId, input.articleId))
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

  db.delete(articleTranslation)
    .where(
      and(
        eq(articleTranslation.articleId, input.articleId),
        eq(articleTranslation.locale, input.locale),
      ),
    )
    .run();
  db.update(article)
    .set({ updatedAt: ctx.clock.now().toISOString() })
    .where(eq(article.id, input.articleId))
    .run();

  await syncArticleAssets(ctx, input.articleId);
  return finishMutation("article", () => loadArticle(ctx, input.articleId));
}

function renameArticleSlug(ctx: ArticleContext, articleId: string, requested: string): ArticleMutationFailure | null {
  const db = ctx.database.db;
  const normalised = normaliseSlug(requested);
  if (!isSafeSlug(normalised)) {
    return { ok: false, reason: "invalid-slug" };
  }
  if (isSlugTaken(ctx, normalised, articleId)) {
    return { ok: false, reason: "duplicate-slug" };
  }

  const current = db.select().from(articleSlug).where(eq(articleSlug.articleId, articleId)).get();
  if (current !== undefined && current.slug === normalised) {
    return null;
  }

  const now = ctx.clock.now().toISOString();
  db.transaction((tx) => {
    // The Slug may come back from this Article's own history.
    tx.delete(articleSlugHistory)
      .where(
        and(eq(articleSlugHistory.slug, normalised), eq(articleSlugHistory.articleId, articleId)),
      )
      .run();

    if (current !== undefined) {
      tx.delete(articleSlug).where(eq(articleSlug.articleId, articleId)).run();
      tx.insert(articleSlugHistory)
        .values({ slug: current.slug, articleId, replacedAt: now })
        .run();
    }
    tx.insert(articleSlug).values({ slug: normalised, articleId, assignedAt: now }).run();
  });

  return null;
}

export async function updateArticleMeta(
  ctx: ArticleContext,
  input: {
    articleId: string;
    slug?: string;
    defaultLocale?: Locale;
    categoryId?: string | null;
    tagIds?: readonly string[];
  },
): Promise<ArticleMutation> {
  const db = ctx.database.db;
  const existing = db.select().from(article).where(eq(article.id, input.articleId)).get();
  if (existing === undefined) {
    return { ok: false, reason: "not-found" };
  }

  const updates: Partial<ArticleRow> = {};

  if (input.defaultLocale !== undefined) {
    const translations = db
      .select({ locale: articleTranslation.locale })
      .from(articleTranslation)
      .where(eq(articleTranslation.articleId, input.articleId))
      .all();
    if (!translations.some((row) => row.locale === input.defaultLocale)) {
      return { ok: false, reason: "invalid-locale" };
    }
    updates.defaultLocale = input.defaultLocale;
  }

  if (input.categoryId !== undefined) {
    if (input.categoryId === null) {
      updates.categoryId = null;
    } else {
      const category = loadCategoryViews(ctx, [input.categoryId]).get(input.categoryId);
      if (category === undefined) {
        return { ok: false, reason: "unknown-category" };
      }
      updates.categoryId = input.categoryId;
    }
  }

  if (input.slug !== undefined) {
    const failure = renameArticleSlug(ctx, input.articleId, input.slug);
    if (failure !== null) {
      return failure;
    }
  }

  if (input.tagIds !== undefined) {
    const tagIds = [...new Set(input.tagIds)];
    const known = loadTagViews(ctx, tagIds);
    if (tagIds.some((tagId) => !known.has(tagId))) {
      return { ok: false, reason: "unknown-tag" };
    }
    db.transaction((tx) => {
      tx.delete(articleTag).where(eq(articleTag.articleId, input.articleId)).run();
      if (tagIds.length > 0) {
        tx.insert(articleTag)
          .values(tagIds.map((tagId) => ({ articleId: input.articleId, tagId })))
          .run();
      }
    });
  }

  db.update(article)
    .set({ ...updates, updatedAt: ctx.clock.now().toISOString() })
    .where(eq(article.id, input.articleId))
    .run();

  return finishMutation("article", () => loadArticle(ctx, input.articleId));
}

function writeRevisions(ctx: ArticleContext, articleId: string, kind: RevisionKind): ArticleRevisionView[] {
  const db = ctx.database.db;
  const now = ctx.clock.now();
  const createdAt = now.toISOString();
  const translations = db
    .select()
    .from(articleTranslation)
    .where(eq(articleTranslation.articleId, articleId))
    .orderBy(asc(articleTranslation.locale))
    .all();

  const created: ArticleRevisionView[] = [];
  for (const translation of translations) {
    const revisionId = generateUlid(now);
    const row = {
      id: revisionId,
      articleId,
      locale: translation.locale,
      kind,
      title: translation.title,
      summary: translation.summary,
      bodyJson: translation.bodyJson,
      bodyMarkdown: translation.bodyMarkdown,
      createdAt,
    };
    db.insert(articleRevision).values(row).run();
    created.push(toRevisionView(row));
  }

  pruneRevisions(ctx, articleId);
  return created;
}

function pruneRevisions(ctx: ArticleContext, articleId: string): void {
  const db = ctx.database.db;
  const rows = db
    .select({
      id: articleRevision.id,
      kind: articleRevision.kind,
      createdAt: articleRevision.createdAt,
      locale: articleRevision.locale,
    })
    .from(articleRevision)
    .where(eq(articleRevision.articleId, articleId))
    .all();

  const byLocale = groupBy(rows, (row) => row.locale);
  const prunable = [...byLocale.values()].flatMap((localeRows) =>
    selectPrunableRevisions(localeRows, articleConfig.automaticRevisionKeep),
  );
  if (prunable.length === 0) {
    return;
  }

  db.delete(articleRevision).where(inArray(articleRevision.id, prunable)).run();
}

export async function publishArticle(
  ctx: ArticleContext,
  input: { articleId: string; publishTime?: string | null },
): Promise<ArticleMutation> {
  const db = ctx.database.db;
  const existing = db.select().from(article).where(eq(article.id, input.articleId)).get();
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

  db.update(article)
    .set({
      publicationState: "published",
      publishTime,
      updatedAt: ctx.clock.now().toISOString(),
    })
    .where(eq(article.id, input.articleId))
    .run();

  writeRevisions(ctx, input.articleId, "publish");
  return finishMutation("article", () => loadArticle(ctx, input.articleId));
}

export async function archiveArticle(
  ctx: ArticleContext,
  input: { articleId: string },
): Promise<ArticleMutation> {
  const db = ctx.database.db;
  const existing = db.select().from(article).where(eq(article.id, input.articleId)).get();
  if (existing === undefined) {
    return { ok: false, reason: "not-found" };
  }
  if (existing.publicationState !== "published") {
    return { ok: false, reason: "not-published" };
  }

  db.update(article)
    .set({ publicationState: "archived", updatedAt: ctx.clock.now().toISOString() })
    .where(eq(article.id, input.articleId))
    .run();

  return finishMutation("article", () => loadArticle(ctx, input.articleId));
}

export async function unarchiveArticle(
  ctx: ArticleContext,
  input: { articleId: string },
): Promise<ArticleMutation> {
  const db = ctx.database.db;
  const existing = db.select().from(article).where(eq(article.id, input.articleId)).get();
  if (existing === undefined) {
    return { ok: false, reason: "not-found" };
  }
  if (existing.publicationState !== "archived") {
    return { ok: false, reason: "not-archived" };
  }

  db.update(article)
    .set({ publicationState: "published", updatedAt: ctx.clock.now().toISOString() })
    .where(eq(article.id, input.articleId))
    .run();

  return finishMutation("article", () => loadArticle(ctx, input.articleId));
}

export async function deleteArticlePermanently(
  ctx: ArticleContext,
  articleId: string,
): Promise<{ deleted: true } | { deleted: false; reason: "not-found" }> {
  const db = ctx.database.db;
  const existing = db.select({ id: article.id }).from(article).where(eq(article.id, articleId)).get();
  if (existing === undefined) {
    return { deleted: false, reason: "not-found" };
  }

  // The Slug rows survive with a null articleId: that is the 410 tombstone.
  db.transaction((tx) => {
    tx.delete(article).where(eq(article.id, articleId)).run();
    tx.delete(assetReference)
      .where(
        and(
          eq(assetReference.contentKind, ARTICLE_CONTENT_KIND),
          eq(assetReference.contentId, articleId),
        ),
      )
      .run();
  });

  return { deleted: true };
}

export async function listRevisions(
  ctx: ArticleContext,
  articleId: string,
): Promise<ArticleRevisionView[]> {
  return ctx.database.db
    .select()
    .from(articleRevision)
    .where(eq(articleRevision.articleId, articleId))
    .orderBy(desc(articleRevision.createdAt), asc(articleRevision.locale))
    .all()
    .map(toRevisionView);
}

export async function captureAutomaticRevision(
  ctx: ArticleContext,
  input: { articleId: string },
): Promise<AutomaticRevisionOutcome> {
  const db = ctx.database.db;
  const existing = db.select({ id: article.id }).from(article).where(eq(article.id, input.articleId)).get();
  if (existing === undefined) {
    return { ok: false, reason: "not-found" };
  }

  const latest = db
    .select({ createdAt: articleRevision.createdAt })
    .from(articleRevision)
    .where(
      and(
        eq(articleRevision.articleId, input.articleId),
        eq(articleRevision.kind, "automatic"),
      ),
    )
    .orderBy(desc(articleRevision.createdAt))
    .get();

  const lastAutomaticAt = latest === undefined ? null : new Date(latest.createdAt);
  if (
    !shouldCaptureAutomaticRevision(
      lastAutomaticAt,
      ctx.clock.now(),
      articleConfig.automaticRevisionIntervalMs,
    )
  ) {
    return { ok: true, created: false };
  }

  const [revision] = writeRevisions(ctx, input.articleId, "automatic");
  return { ok: true, created: true, revision: revision ?? null };
}

export async function restoreRevision(
  ctx: ArticleContext,
  input: { articleId: string; revisionId: string },
): Promise<ArticleMutation> {
  const db = ctx.database.db;
  const revision = db
    .select()
    .from(articleRevision)
    .where(
      and(
        eq(articleRevision.id, input.revisionId),
        eq(articleRevision.articleId, input.articleId),
      ),
    )
    .get();
  if (revision === undefined) {
    return { ok: false, reason: "not-found" };
  }

  const now = ctx.clock.now().toISOString();
  const existing = db
    .select()
    .from(articleTranslation)
    .where(
      and(
        eq(articleTranslation.articleId, input.articleId),
        eq(articleTranslation.locale, revision.locale),
      ),
    )
    .get();

  if (existing === undefined) {
    db.insert(articleTranslation)
      .values({
        articleId: input.articleId,
        locale: revision.locale,
        title: revision.title,
        summary: revision.summary,
        bodyJson: revision.bodyJson,
        bodyMarkdown: revision.bodyMarkdown,
        version: 1,
        createdAt: now,
        updatedAt: now,
      })
      .run();
  } else {
    db.update(articleTranslation)
      .set({
        title: revision.title,
        summary: revision.summary,
        bodyJson: revision.bodyJson,
        bodyMarkdown: revision.bodyMarkdown,
        // A pending editor still holding the pre-restore version must not win.
        version: existing.version + 1,
        updatedAt: now,
      })
      .where(
        and(
          eq(articleTranslation.articleId, input.articleId),
          eq(articleTranslation.locale, revision.locale),
        ),
      )
      .run();
  }

  db.update(article).set({ updatedAt: now }).where(eq(article.id, input.articleId)).run();
  await syncArticleAssets(ctx, input.articleId);
  return finishMutation("article", () => loadArticle(ctx, input.articleId));
}

export async function resolveArticleSlug(
  ctx: ArticleContext,
  slug: string,
): Promise<SlugResolution> {
  const db = ctx.database.db;

  const current = db.select().from(articleSlug).where(eq(articleSlug.slug, slug)).get();
  if (current !== undefined) {
    if (current.articleId === null) {
      return { kind: "permanently-removed" };
    }
    const detail = loadArticle(ctx, current.articleId);
    if (detail === null) {
      return { kind: "permanently-removed" };
    }
    return { kind: "found", article: detail, slugKind: "current" };
  }

  const historical = db
    .select()
    .from(articleSlugHistory)
    .where(eq(articleSlugHistory.slug, slug))
    .get();
  if (historical !== undefined) {
    if (historical.articleId === null) {
      return { kind: "permanently-removed" };
    }
    const detail = loadArticle(ctx, historical.articleId);
    if (detail === null) {
      return { kind: "permanently-removed" };
    }
    return { kind: "found", article: detail, slugKind: "historical" };
  }

  return { kind: "not-found" };
}

export async function findReadableArticle(
  ctx: ArticleContext,
  input: { slug: string; locale: Locale },
): Promise<ReadableArticle> {
  const resolution = await resolveArticleSlug(ctx, input.slug);
  if (resolution.kind !== "found") {
    return resolution;
  }

  const { article: detail } = resolution;
  const now = ctx.clock.now();
  const publication = { state: detail.publicationState, publishTime: detail.publishTime };
  if (!isReadableByUrl(publication, now)) {
    return { kind: "not-found" };
  }

  const selection = selectTranslation(detail.translations, input.locale, detail.defaultLocale);
  if (selection === null) {
    return { kind: "not-found" };
  }

  return {
    kind: "found",
    article: detail,
    translation: selection.translation,
    fellBack: selection.fellBack,
    indexable: isIndexable(publication, now) && !selection.fellBack,
  };
}
