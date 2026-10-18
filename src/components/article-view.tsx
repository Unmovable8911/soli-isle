import Link from "next/link";

import type { Locale } from "@/config/site";
import type { LanguageVersionLink } from "@/domain/article-language";
import type { ArticleHeading } from "@/domain/table-of-contents";
import type { Messages } from "@/messages";

import { ArticleBody } from "./article-body";
import { ArticleLanguageVersions, FallbackNotice } from "./article-language";
import { ArrowLeftIcon, ArrowRightIcon } from "./icons";
import { ImageZoom } from "./lightbox";

export type ArticleViewLabels = Pick<
  Messages["reader"],
  "article" | "languages" | "fallback" | "lightbox"
>;

export interface ArticleNeighbourLink {
  title: string;
  href: string;
}

export interface ArticleViewProps {
  title: string;
  /** The dek under the title: what the piece is about, above the fold. */
  summary: string;
  /** The stored instant, which the `time` element publishes. */
  publishTime: string | null;
  /** That instant, already formatted: this surface owns no clock. */
  publishedOn: string;
  category: { name: string; href: string } | null;
  cover: { address: string } | null;
  /** The body as the one renderer produced it, anchors included. */
  bodyHtml: string;
  /** Derived from the body by `buildTableOfContents`; empty when it is short. */
  toc: readonly ArticleHeading[];
  versions: {
    current: Locale;
    links: readonly LanguageVersionLink[];
    names: Record<Locale, string>;
  };
  fallback: { requested: string; shown: string } | null;
  tags: readonly { name: string; href: string }[];
  neighbours: { previous: ArticleNeighbourLink | null; next: ArticleNeighbourLink | null };
  labels: ArticleViewLabels;
}

interface TocSection {
  heading: ArticleHeading | null;
  children: ArticleHeading[];
}

/** h3 nests under the h2 it follows; an h3 above every h2 stands on its own. */
function sectionsOf(toc: readonly ArticleHeading[]): TocSection[] {
  const sections: TocSection[] = [];
  for (const heading of toc) {
    if (heading.level === 2) {
      sections.push({ heading, children: [] });
      continue;
    }
    const last = sections.at(-1);
    if (last === undefined) {
      sections.push({ heading: null, children: [heading] });
    } else {
      last.children.push(heading);
    }
  }
  return sections;
}

function TocEntry({ heading }: { heading: ArticleHeading }) {
  return (
    <li className="article-toc-item" data-level={heading.level}>
      <a href={`#${heading.id}`}>{heading.text}</a>
    </li>
  );
}

/**
 * The Article page: kicker, title, dek, meta, cover, contents, prose, tags and
 * the pager, in that order in the DOM as well as on screen — printing and a
 * Reader-mode pass both follow the same sequence. The page fetches, this
 * arranges.
 */
export function ArticleView({
  title,
  summary,
  publishTime,
  publishedOn,
  category,
  cover,
  bodyHtml,
  toc,
  versions,
  fallback,
  tags,
  neighbours,
  labels,
}: ArticleViewProps) {
  const sections = sectionsOf(toc);

  return (
    <article className="reader-article">
      <header className="reader-article-header">
        {category !== null && (
          <Link className="article-kicker" href={category.href}>
            {category.name}
          </Link>
        )}
        <h1>{title}</h1>
        {summary !== "" && <p className="reader-article-dek">{summary}</p>}
        <div className="reader-article-meta">
          {publishTime !== null && (
            <p className="reader-article-date">
              <span>{labels.article.publishedOn}</span>{" "}
              <time dateTime={publishTime}>{publishedOn}</time>
            </p>
          )}
          <ArticleLanguageVersions
            current={versions.current}
            versions={versions.links}
            names={versions.names}
            labels={labels.languages}
          />
          {fallback !== null && (
            <FallbackNotice
              labels={labels.fallback}
              requested={fallback.requested}
              shown={fallback.shown}
            />
          )}
        </div>
      </header>
      {/* Never cropped and never a placeholder: an Article without a cover
          simply starts with its contents. The H1 above already names the
          work, so the image is decorative. */}
      {cover !== null && (
        <figure className="reader-article-cover">
          {/* eslint-disable-next-line @next/next/no-img-element -- addresses come from the Asset store, not the image optimizer */}
          <img src={cover.address} alt="" />
        </figure>
      )}
      <div className="reader-article-layout">
        {sections.length > 0 && (
          <nav className="article-toc" aria-labelledby="article-toc-title">
            <p className="article-toc-title" id="article-toc-title">
              {labels.article.toc}
            </p>
            <ul className="article-toc-list">
              {sections.map((section) =>
                section.heading === null ? (
                  section.children.map((heading) => <TocEntry key={heading.id} heading={heading} />)
                ) : (
                  <li
                    className="article-toc-item"
                    data-level={section.heading.level}
                    key={section.heading.id}
                  >
                    <a href={`#${section.heading.id}`}>{section.heading.text}</a>
                    {section.children.length > 0 && (
                      <ul className="article-toc-sublist">
                        {section.children.map((heading) => (
                          <TocEntry key={heading.id} heading={heading} />
                        ))}
                      </ul>
                    )}
                  </li>
                ),
              )}
            </ul>
          </nav>
        )}
        <div className="reader-article-main">
          <ImageZoom labels={labels.lightbox}>
            <ArticleBody html={bodyHtml} />
          </ImageZoom>
          {tags.length > 0 && (
            <div className="reader-article-tags">
              <p className="reader-tags-label">{labels.article.tags}</p>
              <ul className="reader-tags">
                {tags.map((tag) => (
                  <li key={tag.href}>
                    <Link href={tag.href}>{tag.name}</Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <nav className="reader-article-nav" aria-label={title}>
            {neighbours.previous !== null && (
              <Link className="reader-article-previous" href={neighbours.previous.href}>
                <span className="reader-article-nav-label">
                  <ArrowLeftIcon width="14" height="14" />
                  {labels.article.previous}
                </span>
                <span className="reader-article-nav-title">{neighbours.previous.title}</span>
              </Link>
            )}
            {neighbours.next !== null && (
              <Link className="reader-article-next" href={neighbours.next.href}>
                <span className="reader-article-nav-label">
                  {labels.article.next}
                  <ArrowRightIcon width="14" height="14" />
                </span>
                <span className="reader-article-nav-title">{neighbours.next.title}</span>
              </Link>
            )}
          </nav>
        </div>
      </div>
    </article>
  );
}
