import type { Locale } from "@/config/site";
import { formatPublishDate } from "@/domain/article-time";
import { buildArticlePath } from "@/domain/article-url";
import { messages } from "@/messages";
import { hasCover, type ReaderArticleCard } from "@/services/reading";

import { ArticleGrid } from "./article-grid";
import { EmptyState } from "./empty-state";
import { HomeHero, type HomeHeroSlide } from "./home-hero";

/**
 * The newest Articles the hero carries. They are taken from the head of the
 * same newest-first list the grid reads, so the Author chooses neither: the
 * carousel is simply what was written last.
 */
export const HOME_HERO_LIMIT = 5;

/**
 * How many Articles the grid holds after the hero. The two limits are added
 * together by the page, and every Article appears once: the hero is not a
 * second showing of the cards below it.
 */
export const HOME_GRID_LIMIT = 20;

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
 * hero, then the rest as a card grid. A Reader with nothing to read gets one
 * sentence — never an empty carousel, and never a Post, which belongs to the
 * Feed.
 *
 * The visible page starts with the cover; the site's name stays as the page's
 * first-level heading for assistive technology and the document outline.
 *
 * The grid is the one every browse surface draws, so a Category or a Tag reads
 * as a continuation of this page rather than as a second layout.
 */
export function ReaderHome({
  articles,
  locale,
}: {
  /** Every published Article in this Locale, newest first. */
  articles: readonly ReaderArticleCard[];
  locale: Locale;
}) {
  const t = messages[locale];
  const slides = heroSlides(articles, locale);
  const rest = articles.slice(HOME_HERO_LIMIT, HOME_HERO_LIMIT + HOME_GRID_LIMIT);

  return (
    <>
      <h1 className="home-title">{t.chrome.siteName}</h1>
      {slides.length === 0 ? (
        <EmptyState title={t.reader.home.emptyTitle} body={t.reader.home.empty} />
      ) : (
        <>
          <HomeHero slides={slides} labels={t.reader.home.hero} />
          {rest.length > 0 && <ArticleGrid articles={rest} locale={locale} />}
        </>
      )}
    </>
  );
}
