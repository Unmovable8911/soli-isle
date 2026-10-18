import Link from "next/link";

import type { Locale } from "@/config/site";
import { formatArchiveDay, formatArchiveMonth, type ArchiveMonth } from "@/domain/article-time";
import { buildArticlePath } from "@/domain/article-url";
import { buildCategoryPath } from "@/domain/public-paths";
import { messages } from "@/messages";
import type { ReaderArticleCard } from "@/services/reading";

/**
 * The Archive as an index rather than a gallery: every month a label with the
 * count of what was written in it, then one dense row per Article — the day, the
 * title, the Category. A Reader comes here to find "what did I write that
 * month", so a cover and an excerpt are noise; the hairline between rows is the
 * whole of the decoration.
 */
export function ArchiveIndex({
  months,
  locale,
}: {
  /** Months as archiveMonths() bucketed them, newest first. */
  months: readonly ArchiveMonth<ReaderArticleCard>[];
  locale: Locale;
}) {
  return (
    <>
      {months.map((month) => (
        <section key={`${month.year}-${month.month}`} className="archive-month">
          <h2 className="archive-month-head">
            <span className="archive-month-label">
              {formatArchiveMonth(month.year, month.month, locale)}
            </span>
            <span className="archive-month-count">
              {messages[locale].reader.list.count.replaceAll("{count}", String(month.items.length))}
            </span>
          </h2>
          <ol className="archive-rows">
            {month.items.map((article) => (
              <li key={article.id} className="archive-row">
                {article.publishTime !== null && (
                  <time className="archive-row-date" dateTime={article.publishTime}>
                    {formatArchiveDay(article.publishTime)}
                  </time>
                )}
                <Link
                  className="archive-row-title"
                  href={buildArticlePath({ locale, slug: article.slug })}
                >
                  {article.title}
                </Link>
                {article.category !== null && (
                  <Link
                    className="archive-row-category"
                    href={buildCategoryPath({
                      locale,
                      categoryPath: article.category.path,
                    })}
                  >
                    {article.category.name}
                  </Link>
                )}
              </li>
            ))}
          </ol>
        </section>
      ))}
    </>
  );
}
