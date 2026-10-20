import type { Locale } from "@/config/site";
import { formatPublishDate } from "@/domain/article-time";
import { buildArticlePath } from "@/domain/article-url";
import { isWithinCategoryPath } from "@/domain/category-path";
import { paginate } from "@/domain/pagination";
import { messages } from "@/messages";
import { hasCover, type ReaderArticleCard, type ReaderCategoryNode } from "@/services/reading";

import { ArticleCategoryFilter } from "./article-category-filter";
import { ArticleGrid } from "./article-grid";
import { EmptyState } from "./empty-state";
import { HomeHero, type HomeHeroSlide } from "./home-hero";
import { HomePagination } from "./home-pagination";

/**
 * The newest Articles the hero carries. They are taken from the head of the
 * same newest-first list the grid reads, so the Author chooses neither: the
 * carousel is simply what was written last.
 */
export const HOME_HERO_LIMIT = 5;

/**
 * How many Articles one page of the listing holds. Small enough that a page is
 * a screenful and a walk down the listing is a few clicks, large enough that
 * the grid is still a grid at every width.
 */
export const HOME_PAGE_SIZE = 12;

/** The server's half of the carousel: links and dates settled before hydration. */
function heroSlides(
  articles: readonly ReaderArticleCard[],
  locale: Locale,
): HomeHeroSlide[] {
  return articles.slice(0, HOME_HERO_LIMIT).map((article) => {
    const dateLabel =
      article.publishTime === null ? "" : formatPublishDate(article.publishTime, locale);
    return {
      id: article.id,
      href: buildArticlePath({ locale, slug: article.slug }),
      title: article.title,
      summary: article.summary.length === 0 ? null : article.summary,
      category: article.category?.name ?? null,
      dateLabel: dateLabel === "" ? null : dateLabel,
      dateTime: article.publishTime,
      cover: hasCover(article.cover) ? article.cover : null,
    };
  });
}

/**
 * The front page as an editorial front page: the newest five Articles as a
 * hero, then the whole archive a page at a time, with a row of Categories above
 * it and the way to the other pages below. A Reader with nothing to read gets
 * one sentence — never an empty carousel, and never a Post, which belongs to
 * the Feed. A Category that holds nothing says so in the site's EmptyState, the
 * state every other bare surface already uses.
 *
 * The hero is a highlight, not an exclusion: its five Articles appear again in
 * the grid, so paging down the listing reaches everything the site has
 * published rather than everything but five.
 *
 * Filtering and paging are both URLs, resolved on the server, so every view of
 * the listing can be linked to, reloaded and read with no JavaScript at all.
 *
 * The visible page starts with the cover; the site's name stays as the page's
 * first-level heading for assistive technology and the document outline.
 */
export function ReaderHome({
  articles,
  categories,
  locale,
  categoryPath = null,
  page = 1,
}: {
  /** Every published Article for the Locale, newest first. */
  articles: readonly ReaderArticleCard[];
  /** Top-level Categories only. */
  categories: readonly ReaderCategoryNode[];
  locale: Locale;
  /** The selected Category path, already validated by the page; null means "Latest". */
  categoryPath?: string | null;
  /** The requested page, already parsed; may be out of range. */
  page?: number;
}) {
  const t = messages[locale];
  const slides = heroSlides(articles, locale);

  if (slides.length === 0) {
    return (
      <>
        <h1 className="home-title">{t.chrome.siteName}</h1>
        <EmptyState title={t.reader.home.emptyTitle} body={t.reader.home.empty} />
      </>
    );
  }

  // A Category lists its own Articles plus every descendant's: the same
  // predicate the reading service uses, so the page and the Category page
  // never disagree about what belongs to a Category.
  const listing =
    categoryPath === null
      ? articles
      : articles.filter((article) => {
          const path = article.category?.path;
          return path !== undefined && isWithinCategoryPath(path, categoryPath);
        });
  const slice = paginate(listing, page, HOME_PAGE_SIZE);

  return (
    <>
      <h1 className="home-title">{t.chrome.siteName}</h1>
      <HomeHero slides={slides} labels={t.reader.home.hero} />
      <ArticleCategoryFilter
        categories={categories}
        locale={locale}
        categoryPath={categoryPath}
      />
      {slice.items.length === 0 ? (
        <EmptyState title={t.reader.home.emptyTitle} body={t.reader.home.emptyCategory} />
      ) : (
        <ArticleGrid articles={slice.items} locale={locale} />
      )}
      <HomePagination
        locale={locale}
        categoryPath={categoryPath}
        page={slice.page}
        pageCount={slice.pageCount}
      />
    </>
  );
}
