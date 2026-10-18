import Link from "next/link";

import type { Locale } from "@/config/site";
import { buildArchivePath, buildFeedPath, buildHomePath } from "@/domain/public-paths";
import type { Messages } from "@/messages";

export type SiteNavLabels = Messages["reader"]["nav"];

/**
 * The site navigation: the home page, the archive and the Feed. Its accessible
 * name is its own; naming the whole navigation after one of its destinations
 * tells a screen reader nothing.
 *
 * `currentPath` is passed in rather than read from a hook so this stays a plain
 * component: the top bar and the drawer each get the marker from one client
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
    { href: buildHomePath(locale), label: labels.home, exact: true },
    { href: buildArchivePath(locale), label: labels.archive, exact: false },
    { href: buildFeedPath({ locale }), label: labels.feed, exact: false },
  ] as const;

  return (
    <nav className="site-nav" aria-label={labels.label}>
      <ul>
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={isCurrent(currentPath, item.href, item.exact) ? "page" : undefined}
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
 * A section is current at its own address and below it — a Tag-filtered Feed is
 * still "Feed". Home is the exception: every path is below the Locale root, so
 * only its exact address is "Home".
 */
function isCurrent(pathname: string | null, href: string, exact: boolean): boolean {
  if (pathname === null) {
    return false;
  }
  return pathname === href || (!exact && pathname.startsWith(`${href}/`));
}
