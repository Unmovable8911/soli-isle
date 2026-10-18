import Link from "next/link";

import type { Locale } from "@/config/site";
import {
  buildArchivePath,
  buildCategoryIndexPath,
  buildFeedPath,
  buildSearchPath,
} from "@/domain/public-paths";
import type { Messages } from "@/messages";

export type SiteNavLabels = Messages["reader"]["nav"];

/**
 * The site navigation. Its accessible name is its own — the links are
 * Categories, the archive, the Feed and search, so naming the whole navigation
 * after one of its four destinations tells a screen reader nothing.
 *
 * `currentPath` is passed in rather than read from a hook so this stays a plain
 * component: the rail and the drawer each get the marker from one client
 * wrapper, and the server-rendered HTML already carries it with JavaScript off.
 */
export function SiteNav({
  locale,
  labels,
  currentPath = null,
}: {
  locale: Locale;
  labels: SiteNavLabels;
  currentPath?: string | null;
}) {
  const items = [
    { href: buildCategoryIndexPath(locale), label: labels.categories },
    { href: buildArchivePath(locale), label: labels.archive },
    { href: buildFeedPath({ locale }), label: labels.feed },
    { href: buildSearchPath({ locale }), label: labels.search },
  ] as const;

  return (
    <nav className="site-nav" aria-label={labels.label}>
      <ul>
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={isCurrent(currentPath, item.href) ? "page" : undefined}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/**
 * A section is current at its own address and below it — a Category page is
 * still "Categories", and a Tag-filtered Feed is still "Feed".
 */
function isCurrent(pathname: string | null, href: string): boolean {
  if (pathname === null) {
    return false;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
