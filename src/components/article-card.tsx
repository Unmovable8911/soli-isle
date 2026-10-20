import Link from "next/link";
import type { ReactNode } from "react";

import { hasCover, type ReaderCover } from "@/services/reading";
/**
 * One Article as a card: the cover, the Category above the title, the title,
 * a three-line excerpt and the meta line. The home page, a Category, a Tag and
 * the search results all draw the same card, so nothing here is home-specific.
 *
 * The title is the link. A card is not one: a click handler on the container
 * would put an anchor nowhere in the tab order, so there is deliberately no
 * such handler and no wrapping link.
 */
export interface ArticleCardProps {
  /** The Article's page in this Locale. */
  href: string;
  title: ReactNode;
  /** The Category (or other one-line label) above the title. */
  kicker?: ReactNode;
  /** Makes the kicker a link to what it names. Omitted, it is plain text. */
  kickerHref?: string;
  /** The three-line excerpt. */
  summary?: ReactNode;
  /** A search result's body excerpt, shown instead of the summary. */
  snippet?: ReactNode | null;
  /** Publish Time and whatever else the surface adds to the meta line. */
  meta?: ReactNode;
  /** The card's crop. Null is the designed state of an Article without a cover. */
  cover: ReaderCover | null;
  /** The surface's own modifier, e.g. the front page's lead (suffix of "article-card"). */
  className?: string;
}

export function ArticleCard({
  href,
  title,
  kicker,
  kickerHref,
  summary,
  snippet,
  meta,
  cover,
  className,
}: ArticleCardProps) {
  return (
    <article className={className === undefined ? "article-card" : `article-card ${className}`}>
      {hasCover(cover) && (
        <div className="article-card-cover">
          {/* eslint-disable-next-line @next/next/no-img-element -- the address comes from the Asset store, not the image optimizer */}
          <img
            src={cover.address}
            width={cover.width}
            height={cover.height}
            alt=""
            loading="lazy"
            decoding="async"
          />
        </div>
      )}
      <div className="article-card-body">
        {kicker !== undefined && (
          <p className="article-card-kicker">
            {kickerHref === undefined ? kicker : <Link href={kickerHref}>{kicker}</Link>}
          </p>
        )}
        <h2 className="article-card-title">
          <Link href={href}>{title}</Link>
        </h2>
        {(snippet ?? summary) !== undefined && (
          <p className="article-card-summary">{snippet ?? summary}</p>
        )}
        {meta !== undefined && <p className="article-card-meta">{meta}</p>}
      </div>
    </article>
  );
}
