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
 */
export function SiteNav({ locale, labels }: { locale: Locale; labels: SiteNavLabels }) {
  return (
    <nav className="site-nav" aria-label={labels.label}>
      <ul>
        <li>
          <Link href={buildCategoryIndexPath(locale)}>{labels.categories}</Link>
        </li>
        <li>
          <Link href={buildArchivePath(locale)}>{labels.archive}</Link>
        </li>
        <li>
          <Link href={buildFeedPath({ locale })}>{labels.feed}</Link>
        </li>
        <li>
          <Link href={buildSearchPath({ locale })}>{labels.search}</Link>
        </li>
      </ul>
    </nav>
  );
}
