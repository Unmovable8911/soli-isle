import { and, desc, eq, exists, inArray, isNull, or, sql, type SQL } from "drizzle-orm";

import type { Locale } from "@/config/site";
import type { DatabaseConnection } from "@/db/database";
import {
  article,
  articleSlug,
  articleSlugHistory,
  articleTag,
  articleTranslation,
  assetVariant,
  categoryTranslation,
  tagTranslation,
} from "@/db/schema";
import {
  buildAssetAddress,
  extractAssetIds,
  isSafeAssetId,
  type AssetFormat,
} from "@/domain/asset-address";
import { categoryAncestorPaths, isWithinCategoryPath } from "@/domain/category-path";
import type { Clock } from "@/domain/clock";
import { pickLocalised } from "@/domain/localised";
import { escapeLikeTerm, matchSnippet, parseSearchTerms } from "@/domain/search";
import { flattenTree } from "@/domain/tree";
import { loadCategoryViews, listCategoryTree, type CategoryContext } from "./categories";
import { loadTagViews, listTags, type TagContext } from "./tags";
import { readableByUrl, visibleToReader } from "./visibility";

/**
 * Reader-facing reads: what a public page may list and how.
 *
 * Two rules hold everywhere here, and they are the same rule the Feed uses:
 * only Articles visible to a Reader appear, and only Articles that actually
 * have a version in the requested Locale appear. A Content Fallback page is
 * never linked from a list.
 */
export interface ReadingContext extends CategoryContext, TagContext {
  database: DatabaseConnection;
  clock: Clock;
}

export function createReadingContext(
  database: DatabaseConnection,
  clock: Clock,
): ReadingContext {
  return { database, clock };
}

export interface ReaderCategoryRef {
  slug: string;
  path: string;
  name: string;
}

export interface ReaderTagRef {
  slug: string;
  name: string;
}

/**
 * The cover a card draws, as the display derivation of the chosen image: cards
 * crop it, the Article header shows it whole, and both want the same file.
 * Nullable on the DTO because "no cover" is a legal Article — a list fixture
 * with no cover still is a ReaderArticleCard, and null is the only way to say
 * so. Every caller asks `hasCover` rather than re-testing emptiness.
 */
export interface ReaderCover {
  address: string;
  width: number;
  height: number;
}

export interface ReaderArticleCard {
  id: string;
  slug: string;
  title: string;
  summary: string;
  publishTime: string | null;
  category: ReaderCategoryRef | null;
  /** Null is the one way to say "no cover": a designed state, not a gap. */
  cover: ReaderCover | null;
  tags: ReaderTagRef[];
  /**
   * Only a search result carries one: the body prose around the keyword it
   * matched, so a body hit is readable on the card. Null (or absent) when the
   * body holds none of the terms.
   */
  snippet?: string | null;
}

/**
 * The one test for "does this have a cover", shared by the card, the front
 * page's lead and the Article header. Absence has exactly one spelling: null.
 */
export function hasCover(cover: ReaderCover | null): cover is ReaderCover {
  return cover !== null;
}

export interface ReaderCategoryNode {
  id: string;
  slug: string;
  path: string;
  name: string;
  /** Visible Articles in this Category and everything below it, in this Locale. */
  count: number;
  children: ReaderCategoryNode[];
}

export interface ReaderCategoryPage {
  category: ReaderCategoryNode;
  /** Root first, the requested Category last. */
  breadcrumbs: ReaderCategoryRef[];
  articles: ReaderArticleCard[];
}

export interface ReaderTagPage {
  tag: ReaderTagRef;
  articles: ReaderArticleCard[];
}

export interface ReaderSearchResult extends ReaderArticleCard {
  snippet: string | null;
}

export interface ReaderSearch {
  terms: string[];
  /** Ordered best-first; every result carries the snippet that justifies it. */
  results: ReaderSearchResult[];
}

export interface ArticleNeighbours {
  /** Published before this Article. */
  older: ReaderArticleCard | null;
  /** Published after this Article. */
  newer: ReaderArticleCard | null;
}

export interface IndexableArticlePath {
  path: string;
  lastModified: string;
}

export interface BodyImageInfo {
  /** The untouched upload, for the lightbox. */
  original: string;
  width: number;
  height: number;
}

type ArticleRow = typeof article.$inferSelect;

interface CardRow {
  article: ArticleRow;
  translation: typeof articleTranslation.$inferSelect;
  slug: string;
  /** Left-joined: null on every row of an Article that has no cover. */
  cover: { assetId: string; width: number; height: number } | null;
}

/**
 * The Article lists and search are locale-strict: a Post or Article without a
 * version in the requested Locale is never listed. The visibility half of the
 * rule comes from the shared predicate so the Feed cannot drift from it.
 */
function publishedFilter(nowIso: string) {
  return visibleToReader(article.publicationState, article.publishTime, nowIso);
}

function toCover(row: CardRow["cover"]): ReaderCover | null {
  if (row === null) {
    return null;
  }
  return {
    address: buildAssetAddress({ assetId: row.assetId, variant: "display", format: "webp" }),
    width: row.width,
    height: row.height,
  };
}

function toCard(
  ctx: ReadingContext,
  locale: Locale,
  row: CardRow,
  tagIds: readonly string[],
): ReaderArticleCard {
  const tags = loadTagViews(ctx, tagIds);
  const categoryViews = loadCategoryViews(
    ctx,
    row.article.categoryId === null ? [] : [row.article.categoryId],
  );
  const category = row.article.categoryId === null ? undefined : categoryViews.get(row.article.categoryId);

  return {
    id: row.article.id,
    slug: row.slug,
    title: row.translation.title,
    summary: row.translation.summary,
    publishTime: row.article.publishTime,
    category:
      category === undefined
        ? null
        : {
            slug: category.slug,
            path: category.path,
            name: pickLocalised(category.names, locale, category.slug),
          },
    cover: toCover(row.cover),
    tags: tagIds
      .map((tagId) => tags.get(tagId))
      .filter((view): view is NonNullable<typeof view> => view !== undefined)
      .map((view) => ({ slug: view.slug, name: pickLocalised(view.names, locale, view.slug) }))
      .sort((left, right) => left.slug.localeCompare(right.slug)),
  };
}

function loadTagLinks(
  ctx: ReadingContext,
  articleIds: readonly string[],
): Map<string, string[]> {
  if (articleIds.length === 0) {
    return new Map();
  }
  const rows = ctx.database.db
    .select()
    .from(articleTag)
    .where(inArray(articleTag.articleId, [...articleIds]))
    .all();

  const links = new Map<string, string[]>();
  for (const row of rows) {
    const group = links.get(row.articleId);
    if (group === undefined) {
      links.set(row.articleId, [row.tagId]);
    } else {
      group.push(row.tagId);
    }
  }
  return links;
}

/**
 * The cover half of a card, as one left join on the display derivation. A
 * missing cover stays a null row rather than a second query per Article.
 */
function coverColumns() {
  return { assetId: assetVariant.assetId, width: assetVariant.width, height: assetVariant.height };
}

const COVER_JOIN = and(
  eq(assetVariant.assetId, article.coverAssetId),
  eq(assetVariant.variant, "display"),
);

/** The card query, narrowed by whichever publication predicate the surface needs. */
function queryCards(ctx: ReadingContext, locale: Locale, filter: SQL): ReaderArticleCard[] {
  const db = ctx.database.db;
  const rows = db
    .select({
      article,
      translation: articleTranslation,
      slug: articleSlug.slug,
      cover: coverColumns(),
    })
    .from(article)
    .innerJoin(
      articleTranslation,
      and(
        eq(articleTranslation.articleId, article.id),
        eq(articleTranslation.locale, locale),
      ),
    )
    .innerJoin(articleSlug, eq(articleSlug.articleId, article.id))
    .leftJoin(assetVariant, COVER_JOIN)
    .where(filter)
    .orderBy(desc(article.publishTime), desc(article.id))
    .all();

  const tagLinks = loadTagLinks(
    ctx,
    rows.map((row) => row.article.id),
  );

  return rows.map((row) => toCard(ctx, locale, row, tagLinks.get(row.article.id) ?? []));
}

/** Every Article a Reader can see in this Locale, newest Publish Time first. */
async function loadCards(ctx: ReadingContext, locale: Locale): Promise<ReaderArticleCard[]> {
  return queryCards(ctx, locale, publishedFilter(ctx.clock.now().toISOString()));
}

export async function listRecentArticles(
  ctx: ReadingContext,
  input: { locale: Locale; limit?: number },
): Promise<ReaderArticleCard[]> {
  const cards = await loadCards(ctx, input.locale);
  return input.limit === undefined ? cards : cards.slice(0, input.limit);
}

export async function listArchiveArticles(
  ctx: ReadingContext,
  input: { locale: Locale },
): Promise<ReaderArticleCard[]> {
  return loadCards(ctx, input.locale);
}

function toReaderTree(
  ctx: ReadingContext,
  locale: Locale,
  nodes: Awaited<ReturnType<typeof listCategoryTree>>,
  cards: readonly ReaderArticleCard[],
): ReaderCategoryNode[] {
  return nodes.map((node) => ({
    id: node.id,
    slug: node.slug,
    path: node.path,
    name: pickLocalised(node.names, locale, node.slug),
    count: cards.filter(
      (card) => card.category !== null && isWithinCategoryPath(card.category.path, node.path),
    ).length,
    children: toReaderTree(ctx, locale, node.children, cards),
  }));
}

export async function listReaderCategories(
  ctx: ReadingContext,
  input: { locale: Locale },
): Promise<ReaderCategoryNode[]> {
  const [tree, cards] = await Promise.all([listCategoryTree(ctx), loadCards(ctx, input.locale)]);
  return toReaderTree(ctx, input.locale, tree, cards);
}

export async function findReaderCategory(
  ctx: ReadingContext,
  input: { locale: Locale; categoryPath: string },
): Promise<ReaderCategoryPage | null> {
  const tree = await listReaderCategories(ctx, { locale: input.locale });
  const flat = flattenTree(tree).map((entry) => entry.node);
  const category = flat.find((node) => node.path === input.categoryPath);
  if (category === undefined) {
    return null;
  }

  const byPath = new Map(flat.map((node) => [node.path, node]));
  const breadcrumbs = categoryAncestorPaths(category.path).map((crumb) => {
    const ancestor = byPath.get(crumb.path);
    return {
      slug: crumb.slug,
      path: crumb.path,
      name: ancestor?.name ?? crumb.slug,
    };
  });

  const cards = await loadCards(ctx, input.locale);
  return {
    category,
    breadcrumbs,
    articles: cards.filter(
      (card) => card.category !== null && isWithinCategoryPath(card.category.path, category.path),
    ),
  };
}

export async function findReaderTag(
  ctx: ReadingContext,
  input: { locale: Locale; slug: string },
): Promise<ReaderTagPage | null> {
  const tags = await listTags(ctx);
  const tag = tags.find((candidate) => candidate.slug === input.slug);
  if (tag === undefined) {
    return null;
  }

  const cards = await loadCards(ctx, input.locale);
  return {
    tag: { slug: tag.slug, name: pickLocalised(tag.names, input.locale, tag.slug) },
    articles: cards.filter((card) => card.tags.some((candidate) => candidate.slug === tag.slug)),
  };
}

/**
 * A `LIKE` scan, deliberately: the derived Markdown column exists for search,
 * and a personal site's corpus does not justify FTS. Every keyword must match
 * somewhere in the title, the body, a Tag name or the Category name.
 */
export async function searchArticles(
  ctx: ReadingContext,
  input: { locale: Locale; query: string },
): Promise<ReaderSearch> {
  const terms = parseSearchTerms(input.query);
  if (terms.length === 0) {
    return { terms: [], results: [] };
  }

  const db = ctx.database.db;
  const perTerm = terms.map((term) => {
    const pattern = `%${escapeLikeTerm(term)}%`;
    return or(
      sql`${articleTranslation.title} like ${pattern} escape '\\'`,
      sql`${articleTranslation.bodyMarkdown} like ${pattern} escape '\\'`,
      exists(
        db
          .select({ found: sql`1` })
          .from(articleTag)
          .innerJoin(tagTranslation, eq(tagTranslation.tagId, articleTag.tagId))
          .where(
            and(
              eq(articleTag.articleId, article.id),
              sql`${tagTranslation.name} like ${pattern} escape '\\'`,
            ),
          ),
      ),
      exists(
        db
          .select({ found: sql`1` })
          .from(categoryTranslation)
          .where(
            and(
              eq(categoryTranslation.categoryId, article.categoryId),
              sql`${categoryTranslation.name} like ${pattern} escape '\\'`,
            ),
          ),
      ),
    );
  });

  const rows = db
    .select({
      article,
      translation: articleTranslation,
      slug: articleSlug.slug,
      cover: coverColumns(),
    })
    .from(article)
    .innerJoin(
      articleTranslation,
      and(
        eq(articleTranslation.articleId, article.id),
        eq(articleTranslation.locale, input.locale),
      ),
    )
    .innerJoin(articleSlug, eq(articleSlug.articleId, article.id))
    .leftJoin(assetVariant, COVER_JOIN)
    .where(and(publishedFilter(ctx.clock.now().toISOString()), ...perTerm))
    .orderBy(desc(article.publishTime), desc(article.id))
    .all();

  const tagLinks = loadTagLinks(
    ctx,
    rows.map((row) => row.article.id),
  );
  const lower = terms.map((term) => term.toLowerCase());
  const cards = rows.map(
    (row): ReaderSearchResult => ({
      ...toCard(ctx, input.locale, row, tagLinks.get(row.article.id) ?? []),
      snippet: matchSnippet(row.translation.bodyMarkdown, terms),
    }),
  );

  // A title hit is what the Reader was probably looking for; the publish order
  // is the tie-break, and Array.prototype.sort is stable to preserve it.
  const titleMatches = (card: ReaderArticleCard) => {
    const title = card.title.toLowerCase();
    return lower.every((term) => title.includes(term));
  };
  const ordered = [...cards].sort(
    (left, right) => Number(titleMatches(right)) - Number(titleMatches(left)),
  );

  return { terms, results: ordered };
}

/**
 * The previous/next chain of one URL.
 *
 * It is built from the Articles that answer by URL — visible **and** archived —
 * not from a list: an archived Article has no list to appear in, but its page
 * still exists, so without this it would be the one page with no navigation.
 */
export async function findArticleNeighbours(
  ctx: ReadingContext,
  input: { locale: Locale; articleId: string },
): Promise<ArticleNeighbours | null> {
  const nowIso = ctx.clock.now().toISOString();
  const cards = await queryCards(
    ctx,
    input.locale,
    readableByUrl(article.publicationState, article.publishTime, nowIso),
  );
  const index = cards.findIndex((card) => card.id === input.articleId);
  if (index === -1) {
    return null;
  }
  return {
    older: cards[index + 1] ?? null,
    newer: cards[index - 1] ?? null,
  };
}

/** Only what the Sitemap may contain: visible Articles, one URL per existing Locale version. */
export async function listIndexableArticlePaths(
  ctx: ReadingContext,
): Promise<IndexableArticlePath[]> {
  const db = ctx.database.db;
  const rows = db
    .select({ id: article.id, updatedAt: article.updatedAt, slug: articleSlug.slug })
    .from(article)
    .innerJoin(articleSlug, eq(articleSlug.articleId, article.id))
    .where(publishedFilter(ctx.clock.now().toISOString()))
    .orderBy(desc(article.publishTime), desc(article.id))
    .all();

  if (rows.length === 0) {
    return [];
  }

  const translations = db
    .select({ articleId: articleTranslation.articleId, locale: articleTranslation.locale })
    .from(articleTranslation)
    .where(inArray(articleTranslation.articleId, rows.map((row) => row.id)))
    .all();

  const localesByArticle = new Map<string, Locale[]>();
  for (const translation of translations) {
    const group = localesByArticle.get(translation.articleId);
    if (group === undefined) {
      localesByArticle.set(translation.articleId, [translation.locale]);
    } else {
      group.push(translation.locale);
    }
  }

  return rows.flatMap((row) =>
    (localesByArticle.get(row.id) ?? []).map((locale) => ({
      path: `/${locale}/articles/${encodeURIComponent(row.slug)}`,
      lastModified: row.updatedAt,
    })),
  );
}

/**
 * Slugs that answer 410: the Article is gone but the URL is remembered. The
 * rows survive a permanent delete with a null `articleId`.
 */
export async function listTombstonedSlugs(ctx: ReadingContext): Promise<string[]> {
  const db = ctx.database.db;
  const current = db
    .select({ slug: articleSlug.slug })
    .from(articleSlug)
    .where(isNull(articleSlug.articleId))
    .all()
    .map((row) => row.slug);
  const historical = db
    .select({ slug: articleSlugHistory.slug })
    .from(articleSlugHistory)
    .where(isNull(articleSlugHistory.articleId))
    .all()
    .map((row) => row.slug);

  return [...new Set([...current, ...historical])].sort();
}

/**
 * The original files behind the images an Article body references, so the
 * lightbox can show the untouched upload rather than a derived variant.
 */
export async function resolveBodyImages(
  ctx: ReadingContext,
  bodyJson: string,
): Promise<Map<string, BodyImageInfo>> {
  const assetIds = [...new Set(extractAssetIds(bodyJson))].filter(isSafeAssetId);
  if (assetIds.length === 0) {
    return new Map();
  }

  const rows = ctx.database.db
    .select({
      assetId: assetVariant.assetId,
      format: assetVariant.format,
      width: assetVariant.width,
      height: assetVariant.height,
    })
    .from(assetVariant)
    .where(and(eq(assetVariant.variant, "original"), inArray(assetVariant.assetId, assetIds)))
    .all();

  return new Map(
    rows.map((row) => [
      row.assetId,
      {
        original: buildAssetAddress({
          assetId: row.assetId,
          variant: "original",
          format: row.format as AssetFormat,
        }),
        width: row.width,
        height: row.height,
      },
    ]),
  );
}
