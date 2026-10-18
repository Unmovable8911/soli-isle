import Link from "next/link";

import type { Locale } from "@/config/site";
import { buildHomeListingPath } from "@/domain/public-paths";
import { messages } from "@/messages";
import type { ReaderCategoryNode } from "@/services/reading";

/**
 * The front page's one choice: everything, or one of the top-level Categories.
 * Every entry is a real link, because a filter is a place — a URL that can be
 * shared, paged and reloaded with no JavaScript. Nothing is counted here: on a
 * browse surface the count tells the Reader how much there is to read, but a
 * filter is only a choice, and a number beside it would compete with the page
 * numbers below the grid.
 */
export function ArticleCategoryFilter({
  categories,
  locale,
  categoryPath,
}: {
  /** Top-level Categories only: the filter is one row, not the tree. */
  categories: readonly ReaderCategoryNode[];
  locale: Locale;
  /** The selected Category path, or null for "Latest". */
  categoryPath: string | null;
}) {
  if (categories.length === 0) {
    return null;
  }

  const t = messages[locale].reader.home.filter;

  return (
    <nav className="home-filter" aria-label={t.label}>
      <ul className="home-filter-list">
        <li>
          <Link
            href={buildHomeListingPath({ locale })}
            aria-current={categoryPath === null ? "page" : undefined}
          >
            {t.all}
          </Link>
        </li>
        {categories.map((category) => (
          <li key={category.id}>
            <Link
              href={buildHomeListingPath({ locale, categoryPath: category.path })}
              aria-current={categoryPath === category.path ? "page" : undefined}
            >
              {category.name}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
