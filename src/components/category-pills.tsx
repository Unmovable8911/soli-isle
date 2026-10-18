import Link from "next/link";

import type { Locale } from "@/config/site";
import { buildCategoryPath } from "@/domain/public-paths";
import type { ReaderCategoryNode } from "@/services/reading";

/**
 * A row of Categories, each linking where it names and carrying its own count:
 * the way into the Categories below the one being read, and the whole index on
 * the Category page itself.
 */
export function CategoryPills({
  categories,
  locale,
}: {
  categories: readonly ReaderCategoryNode[];
  locale: Locale;
}) {
  return (
    <ul className="reader-pills">
      {categories.map((category) => (
        <li key={category.id} className="reader-pill">
          <Link href={buildCategoryPath({ locale, categoryPath: category.path })}>
            {category.name}
          </Link>
          <span className="reader-count">{category.count}</span>
        </li>
      ))}
    </ul>
  );
}
