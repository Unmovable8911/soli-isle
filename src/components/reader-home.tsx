import type { Locale } from "@/config/site";
import { messages } from "@/messages";
import type { ReaderArticleCard } from "@/services/reading";

import { ArticleCard } from "./article-card";
import { ArticleGrid, articleCardProps } from "./article-grid";

/**
 * How many Articles the grid holds. The lead is not one of them: it is always
 * the newest published Article, taken from the head of the same newest-first
 * list, so nothing has to be maintained by the Author to choose it.
 */
export const HOME_GRID_LIMIT = 20;

/**
 * The front page as an editorial front page: a masthead closed by a hairline,
 * the newest Article at lead scale, then the rest as a card grid. A Reader with
 * nothing to read gets the masthead and one sentence — never an empty grid, and
 * never a Post, which belongs to the Feed.
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
  const lead = articles[0];
  const rest = articles.slice(1, HOME_GRID_LIMIT + 1);

  return (
    <>
      <div className="home-masthead">
        <h1>{t.chrome.siteName}</h1>
        <p className="home-dek">{t.reader.home.lead}</p>
      </div>
      {lead === undefined ? (
        <p className="reader-empty">{t.reader.home.empty}</p>
      ) : (
        <>
          <ArticleCard
            {...articleCardProps(lead, locale)}
            className={hasCover(lead) ? "article-lead article-lead--split" : "article-lead"}
          />
          <ArticleGrid articles={rest} locale={locale} />
        </>
      )}
    </>
  );
}

function hasCover(article: ReaderArticleCard): boolean {
  return article.cover !== undefined && article.cover !== null;
}
