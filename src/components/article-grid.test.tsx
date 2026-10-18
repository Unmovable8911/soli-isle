import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { ReaderArticleCard } from "@/services/reading";

import { ArticleGrid } from "./article-grid";
import { Breadcrumbs } from "./breadcrumbs";
import { HighlightedText } from "./highlighted-text";

const CARD: ReaderArticleCard = {
  id: "01",
  slug: "hello-world",
  title: "Hello, World",
  summary: "syntax highlighting for a static site",
  publishTime: "2025-06-15T08:30:00.000Z",
  category: { slug: "notes", path: "notes", name: "Notes" },
  cover: null,
  tags: [{ slug: "editor", name: "Editor" }],
};

const COVER = { address: "/media/01JGRID/display.webp", width: 1600, height: 1000 };

describe("highlighted text", () => {
  it("wraps each keyword occurrence in a mark, keeping case", () => {
    const html = renderToStaticMarkup(
      <HighlightedText text="Syntax highlighting" terms={["syntax", "highlight"]} />,
    );

    expect(html).toBe("<mark>Syntax</mark> <mark>highlight</mark>ing");
  });

  it("renders plain text when nothing matches", () => {
    expect(renderToStaticMarkup(<HighlightedText text="nothing" terms={["absent"]} />)).toBe(
      "nothing",
    );
  });

  it("escapes markup instead of injecting it", () => {
    const html = renderToStaticMarkup(<HighlightedText text="<b>bold</b>" terms={[]} />);

    expect(html).not.toContain("<b>");
    expect(html).toContain("&lt;b&gt;");
  });
});

describe("breadcrumbs", () => {
  it("links every level of the path and marks the current one", () => {
    const html = renderToStaticMarkup(
      <Breadcrumbs
        label="Breadcrumb"
        items={[
          { href: "/zh/categories", label: "Categories" },
          { href: "/zh/categories/notes", label: "Notes" },
          { href: "/zh/categories/notes/tools", label: "Tools" },
        ]}
      />,
    );

    expect(html).toContain('aria-label="Breadcrumb"');
    expect(html).toContain('href="/zh/categories/notes"');
    expect(html).toContain('aria-current="page"');
    expect(html).toContain("Tools");
  });
});

describe("the Article grid", () => {
  const empty = "Nothing here yet.";

  it("draws the front page's card, in the front page's grid", () => {
    const html = renderToStaticMarkup(<ArticleGrid articles={[CARD]} locale="en" empty={empty} />);

    expect(html).toContain('<ul class="article-grid">');
    expect(html).toContain('class="article-card"');
    expect(html).toContain('href="/en/articles/hello-world"');
    expect(html).toContain("Hello, World");
    expect(html).toContain("syntax highlighting for a static site");
    expect(html).toContain('dateTime="2025-06-15T08:30:00.000Z"');
    expect(html).toContain("June 15, 2025");
    // The Category is the card's kicker, and it links where it names.
    expect(html).toContain('href="/en/categories/notes"');
    expect(html).toContain("Notes");
  });

  it("crops a cover in the card's own frame", () => {
    const html = renderToStaticMarkup(
      <ArticleGrid articles={[{ ...CARD, cover: COVER }]} locale="en" />,
    );

    expect(html).toContain("<img");
    expect(html).toContain('src="/media/01JGRID/display.webp"');
  });

  it("marks search keywords in the excerpt", () => {
    const html = renderToStaticMarkup(
      <ArticleGrid articles={[CARD]} locale="en" terms={["highlighting"]} />,
    );

    expect(html).toContain("<mark>highlighting</mark>");
  });

  it("marks search keywords in the title too", () => {
    const html = renderToStaticMarkup(
      <ArticleGrid articles={[CARD]} locale="en" terms={["Hello"]} />,
    );

    expect(html).toContain("<mark>Hello</mark>, World");
  });

  it("shows a search result's body excerpt instead of the summary", () => {
    const html = renderToStaticMarkup(
      <ArticleGrid
        articles={[{ ...CARD, snippet: "…the needle sits here…" }]}
        locale="en"
        terms={["needle"]}
      />,
    );

    expect(html).toContain("<mark>needle</mark>");
    expect(html).not.toContain("syntax highlighting for a static site");
  });

  it("says so when there is nothing to list", () => {
    const html = renderToStaticMarkup(<ArticleGrid articles={[]} locale="en" empty={empty} />);

    expect(html).toBe('<p class="reader-empty">Nothing here yet.</p>');
  });

  it("draws no grid at all for a surface that words its own empty state", () => {
    expect(renderToStaticMarkup(<ArticleGrid articles={[]} locale="en" />)).toBe("");
  });
});
