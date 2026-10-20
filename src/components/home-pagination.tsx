import Link from "next/link";

import type { Locale } from "@/config/site";
import { buildHomeListingPath } from "@/domain/public-paths";
import { messages } from "@/messages";

/**
 * The way through the listing. Every page is a real link on the same URL shape
 * the filter uses, so a Category survives paging and the middle of a listing is
 * something a Reader can send to someone else. A listing that fits on one page
 * draws no paginator at all rather than a disabled one.
 *
 * Every entry wears the site's own pill — the page numbers as the list item the
 * Category pills use, the words as the pill itself — so a control here is shaped
 * like a control everywhere else rather than re-declared per surface.
 */
export function HomePagination({
  locale,
  categoryPath,
  page,
  pageCount,
}: {
  locale: Locale;
  /** The selected Category path, or null for "Latest". */
  categoryPath: string | null;
  /** The page actually shown, already clamped into 1..pageCount. */
  page: number;
  pageCount: number;
}) {
  if (pageCount <= 1) {
    return null;
  }

  const t = messages[locale].reader.home.pagination;
  const hrefOf = (target: number) =>
    buildHomeListingPath({ locale, categoryPath, page: target });
  const pages = Array.from({ length: pageCount }, (_, index) => index + 1);

  return (
    <nav className="home-pagination" aria-label={t.label}>
      {page > 1 && (
        <Link className="reader-pill" href={hrefOf(page - 1)}>
          {t.previous}
        </Link>
      )}
      <ol className="home-pagination-pages">
        {pages.map((target) => (
          <li key={target} className="reader-pill">
            <Link
              href={hrefOf(target)}
              aria-label={t.page.replaceAll("{page}", String(target))}
              aria-current={target === page ? "page" : undefined}
            >
              {target}
            </Link>
          </li>
        ))}
      </ol>
      {page < pageCount && (
        <Link className="reader-pill" href={hrefOf(page + 1)}>
          {t.next}
        </Link>
      )}
    </nav>
  );
}
