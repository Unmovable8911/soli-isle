import type { ReactNode } from "react";

import type { Locale } from "@/config/site";
import { formatPublishDate } from "@/domain/article-time";
import { buildArticlePath } from "@/domain/article-url";
import { buildCategoryPath } from "@/domain/public-paths";
import type { ReaderArticleCard } from "@/services/reading";

import { ArticleCard, type ArticleCardProps } from "./article-card";
import { HighlightedText } from "./highlighted-text";

/**
 * The one grid of Articles behind every browse surface: the front page's rest,
 * a Category, a Tag and the search results. A browse surface is the same
 * arrangement as the front page — what it adds is a head above and, on search,
 * the Reader's own keywords marked inside the cards — so the grid, its density
 * and the card are shared instead of re-decided per page.
 */
export function ArticleGrid({
  articles,
  locale,
  terms = [],
  empty,
}: {
  articles: readonly ReaderArticleCard[];
  locale: Locale;
  /** A search's keywords, marked wherever they matched. */
  terms?: readonly string[];
  /** What an empty grid says. Omitted, an empty grid draws nothing at all. */
  empty?: string;
}) {
  if (articles.length === 0) {
    return empty === undefined ? null : <p className="reader-empty">{empty}</p>;
  }

  return (
    <ul className="article-grid">
      {articles.map((article) => (
        <li key={article.id}>
          <ArticleCard {...articleCardProps(article, locale, terms)} />
        </li>
      ))}
    </ul>
  );
}

/**
 * The content half of a card: what any list of Articles shows about one. The
 * Category is the kicker and links where it names; a search result carries a
 * body excerpt, which the card prefers over the summary because that excerpt is
 * the reason the result matched.
 */
export function articleCardProps(
  article: ReaderArticleCard,
  locale: Locale,
  terms: readonly string[] = [],
): Omit<ArticleCardProps, "className"> {
  const category = article.category;
  const snippet = article.snippet ?? "";

  return {
    href: buildArticlePath({ locale, slug: article.slug }),
    title: marked(article.title, terms),
    kicker: category === null ? undefined : category.name,
    kickerHref:
      category === null
        ? undefined
        : buildCategoryPath({ locale, categoryPath: category.path }),
    summary: article.summary.length === 0 ? undefined : marked(article.summary, terms),
    snippet: snippet.length === 0 ? undefined : marked(snippet, terms),
    meta: metaOf(article, locale),
    cover: article.cover,
  };
}

/** The Reader's keywords, drawn as <mark>s inside the text they matched. */
function marked(text: string, terms: readonly string[]): ReactNode {
  return terms.length === 0 ? text : <HighlightedText text={text} terms={terms} />;
}

function metaOf(article: ReaderArticleCard, locale: Locale): ReactNode {
  return article.publishTime === null ? undefined : (
    <time dateTime={article.publishTime}>{formatPublishDate(article.publishTime, locale)}</time>
  );
}
