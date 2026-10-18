import Link from "next/link";

import type { Locale } from "@/config/site";
import { formatPublishDate } from "@/domain/article-time";
import { buildArticlePath } from "@/domain/article-url";
import { buildCategoryPath, buildTagPath } from "@/domain/public-paths";
import type { Messages } from "@/messages";
import type { ReaderArticleCard } from "@/services/reading";

import { HighlightedText } from "./highlighted-text";

export type ArticleListLabels = Messages["reader"]["list"];

/**
 * The one list of Articles every Reader surface uses: home, a Category, a Tag
 * and the search results. `highlight` marks the reader's own keywords wherever
 * they matched — the title, the body snippet a search result carries, or the
 * summary.
 */
export function ArticleList({
  articles,
  locale,
  labels,
  highlight,
}: {
  articles: readonly ReaderArticleCard[];
  locale: Locale;
  labels: ArticleListLabels;
  highlight?: readonly string[];
}) {
  if (articles.length === 0) {
    return <p className="reader-empty">{labels.empty}</p>;
  }

  // Only search passes terms; every other surface marks nothing.
  const terms = highlight ?? [];

  return (
    <ul className="reader-list">
      {articles.map((article) => {
        // A body match is what the reader came for; the summary stands in when
        // the body holds none of the keywords.
        const preview = article.snippet ?? article.summary;

        return (
          <li key={article.id} className="reader-list-item">
            <h2 className="reader-list-title">
              <Link href={buildArticlePath({ locale, slug: article.slug })}>
                <HighlightedText text={article.title} terms={terms} />
              </Link>
            </h2>
            {preview.length > 0 && (
              <p
                className={
                  article.snippet == null
                    ? "reader-list-summary"
                    : "reader-list-summary reader-list-snippet"
                }
              >
                <HighlightedText text={preview} terms={terms} />
              </p>
            )}
            <p className="reader-list-meta">
              {article.publishTime !== null && (
                <time dateTime={article.publishTime}>
                  {formatPublishDate(article.publishTime, locale)}
                </time>
              )}
              {article.category !== null && (
                <>
                  {" · "}
                  <Link
                    href={buildCategoryPath({ locale, categoryPath: article.category.path })}
                    className="reader-list-category"
                  >
                    {article.category.name}
                  </Link>
                </>
              )}
            </p>
            {article.tags.length > 0 && (
              <ul className="reader-tags">
                {article.tags.map((tag) => (
                  <li key={tag.slug}>
                    <Link href={buildTagPath({ locale, slug: tag.slug })}>{tag.name}</Link>
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}
