import type { ReactNode } from "react";

import type { Locale } from "@/config/site";
import { formatPublishDate } from "@/domain/article-time";
import { buildArticlePath } from "@/domain/article-url";
import { buildCategoryPath } from "@/domain/public-paths";
import { messages } from "@/messages";
import type { ReaderArticleCard } from "@/services/reading";

import { ArticleCard } from "./article-card";

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
            {...cardProps(lead, locale)}
            className={hasCover(lead) ? "article-lead article-lead--split" : "article-lead"}
          />
          {rest.length > 0 && (
            <ul className="article-grid">
              {rest.map((article) => (
                <li key={article.id}>
                  <ArticleCard {...cardProps(article, locale)} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </>
  );
}

function hasCover(article: ReaderArticleCard): boolean {
  return article.cover !== undefined && article.cover !== null;
}

/** The content half of a card: what any list of Articles shows about one. */
function cardProps(article: ReaderArticleCard, locale: Locale) {
  const category = article.category;
  return {
    href: buildArticlePath({ locale, slug: article.slug }),
    title: article.title,
    kicker: category === null ? undefined : category.name,
    kickerHref:
      category === null
        ? undefined
        : buildCategoryPath({ locale, categoryPath: category.path }),
    summary: article.summary.length === 0 ? undefined : article.summary,
    meta: metaOf(article, locale),
    cover: article.cover,
  };
}

function metaOf(article: ReaderArticleCard, locale: Locale): ReactNode {
  return article.publishTime === null ? undefined : (
    <time dateTime={article.publishTime}>{formatPublishDate(article.publishTime, locale)}</time>
  );
}
