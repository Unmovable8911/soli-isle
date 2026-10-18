import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { ArticleHeading } from "@/domain/table-of-contents";
import { messages } from "@/messages";

import { ArticleView, type ArticleViewProps } from "./article-view";

const LABELS = {
  article: messages.en.reader.article,
  languages: messages.en.reader.languages,
  fallback: messages.en.reader.fallback,
  lightbox: messages.en.reader.lightbox,
};

const NAMES = messages.en.chrome.localeNames;

const TOC: ArticleHeading[] = [
  { id: "first", level: 2, text: "First" },
  { id: "detail", level: 3, text: "Detail" },
  { id: "second", level: 2, text: "Second" },
  { id: "third", level: 2, text: "Third" },
];

const BODY = '<h2 id="first">First</h2><p>The prose itself.</p>';

function props(overrides: Partial<ArticleViewProps> = {}): ArticleViewProps {
  return {
    title: "An Article",
    summary: "What this piece is about.",
    publishTime: "2025-06-15T08:30:00.000Z",
    publishedOn: "15 June 2025",
    category: { name: "Notes", href: "/en/categories/notes" },
    cover: { address: "/media/cover-1/display.webp" },
    bodyHtml: BODY,
    toc: TOC,
    versions: {
      current: "en",
      links: [{ locale: "en", href: "https://isle.example/en/articles/a", hasVersion: true }],
      names: NAMES,
    },
    fallback: null,
    tags: [{ name: "Editor", href: "/en/tags/editor" }],
    neighbours: {
      previous: { title: "Older piece", href: "/en/articles/older" },
      next: { title: "Newer piece", href: "/en/articles/newer" },
    },
    labels: LABELS,
    ...overrides,
  };
}

function render(overrides: Partial<ArticleViewProps> = {}): string {
  return renderToStaticMarkup(<ArticleView {...props(overrides)} />);
}

/** Where one marker sits in the markup: reading order is document order. */
function at(html: string, marker: string): number {
  const index = html.indexOf(marker);
  expect(index, `missing ${marker}`).toBeGreaterThanOrEqual(0);
  return index;
}

/** The page as a Reader who has the stylesheet switched off would hear it. */
function plainText(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
}

describe("the Article page", () => {
  it("meets the Reader in the order the design sets", () => {
    const html = render();

    const order = [
      at(html, 'class="article-kicker"'),
      at(html, "<h1>An Article</h1>"),
      at(html, 'class="reader-article-dek"'),
      at(html, "<time"),
      at(html, 'class="article-locales"'),
      at(html, 'class="reader-article-cover"'),
      at(html, 'class="article-toc"'),
      at(html, 'class="article-body"'),
      at(html, 'class="reader-tags"'),
      at(html, 'class="reader-article-nav"'),
    ];

    expect(order).toEqual([...order].sort((left, right) => left - right));
  });

  it("prints in the order it is read, table of contents before the prose", () => {
    const text = plainText(render());
    expect(text.indexOf("Notes")).toBeLessThan(text.indexOf("An Article"));
    expect(text.indexOf("An Article")).toBeLessThan(text.indexOf("What this piece is about."));
    expect(text.indexOf("Contents")).toBeLessThan(text.indexOf("The prose itself."));
    expect(text.indexOf("The prose itself.")).toBeLessThan(text.indexOf("Editor"));
  });

  it("keeps the title, the dek and the date semantic", () => {
    const html = render();

    expect(html).toContain("<h1>An Article</h1>");
    expect(html).toContain('<p class="reader-article-dek">What this piece is about.</p>');
    // Attribute names are case-insensitive in HTML; this is how the rest of the
    // suite spells the one `time` element too.
    expect(html).toContain('<time dateTime="2025-06-15T08:30:00.000Z">');
    expect(html).toContain(">15 June 2025</time>");
  });

  it("links every heading the body has, nesting h3 under its h2", () => {
    const html = render();

    expect(html).toContain('<p class="article-toc-title" id="article-toc-title">Contents</p>');
    expect(html).toContain(
      '<li class="article-toc-item" data-level="2"><a href="#first">First</a><ul class="article-toc-sublist">',
    );
    expect(html).toContain('<li class="article-toc-item" data-level="3"><a href="#detail">Detail</a></li>');
    expect(html).toContain('<li class="article-toc-item" data-level="2"><a href="#second">Second</a></li>');
  });

  it("shows no map at all for an Article that is not long enough", () => {
    const html = render({ toc: [] });

    expect(html).not.toContain("article-toc");
    expect(html).not.toContain("Contents");
  });

  it("draws no empty frame when the Article has no cover", () => {
    const html = render({ cover: null });

    expect(html).not.toContain("reader-article-cover");
    expect(html).not.toContain("<figure");
  });

  it("keeps the Locale pills in the meta line and repeats the fallback truthfully", () => {
    const html = render({
      versions: {
        current: "en",
        links: [
          { locale: "en", href: "https://isle.example/en/articles/a", hasVersion: false },
          { locale: "zh", href: "https://isle.example/zh/articles/a", hasVersion: true },
        ],
        names: NAMES,
      },
      fallback: { requested: "English", shown: "中文" },
    });

    const meta = html.slice(at(html, 'class="reader-article-meta"'), at(html, 'class="reader-article-cover"'));
    expect(meta).toContain('data-version="own"');
    expect(meta).toContain('data-version="fallback"');
    expect(meta).toContain('class="reader-notice"');
    expect(meta).toContain("This article has no English version yet");
  });

  it("leaves the neighbouring Articles as the last thing on the page", () => {
    const html = render();

    expect(html).toContain('href="/en/articles/older"');
    expect(html).toContain('href="/en/articles/newer"');
    expect(html.indexOf('href="/en/articles/older"')).toBeLessThan(html.indexOf('href="/en/articles/newer"'));
  });
});
