import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { ReaderArticleCard } from "@/services/reading";

import { ArticleList } from "./article-list";
import { Breadcrumbs } from "./breadcrumbs";
import { HighlightedText } from "./highlighted-text";

const CARD: ReaderArticleCard = {
  id: "01",
  slug: "hello-world",
  title: "Hello, World",
  summary: "syntax highlighting for a static site",
  publishTime: "2025-06-15T08:30:00.000Z",
  category: { slug: "notes", path: "notes", name: "Notes" },
  tags: [{ slug: "editor", name: "Editor" }],
};

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

describe("article list", () => {
  const labels = { empty: "Nothing here yet." };

  it("shows the title, summary, Publish Time and Category of each Article", () => {
    const html = renderToStaticMarkup(
      <ArticleList articles={[CARD]} locale="en" labels={labels} />,
    );

    expect(html).toContain('href="/en/articles/hello-world"');
    expect(html).toContain("Hello, World");
    expect(html).toContain("syntax highlighting for a static site");
    expect(html).toContain('dateTime="2025-06-15T08:30:00.000Z"');
    expect(html).toContain("June 15, 2025");
    expect(html).toContain('href="/en/categories/notes"');
  });

  it("links Tags on the card", () => {
    const html = renderToStaticMarkup(
      <ArticleList articles={[CARD]} locale="zh" labels={labels} />,
    );

    expect(html).toContain('href="/zh/tags/editor"');
  });

  it("highlights search keywords in the summary", () => {
    const html = renderToStaticMarkup(
      <ArticleList articles={[CARD]} locale="en" labels={labels} highlight={["highlighting"]} />,
    );

    expect(html).toContain("<mark>highlighting</mark>");
  });

  it("highlights search keywords in the title too", () => {
    const html = renderToStaticMarkup(
      <ArticleList articles={[CARD]} locale="en" labels={labels} highlight={["Hello"]} />,
    );

    expect(html).toContain("<mark>Hello</mark>, World");
  });

  it("shows the body snippet in place of the summary when the card carries one", () => {
    const html = renderToStaticMarkup(
      <ArticleList
        articles={[{ ...CARD, snippet: "…the needle sits here…" }]}
        locale="en"
        labels={labels}
        highlight={["needle"]}
      />,
    );

    expect(html).toContain("<mark>needle</mark>");
    expect(html).not.toContain("syntax highlighting for a static site");
  });

  it("says so when there is nothing to list", () => {
    const html = renderToStaticMarkup(<ArticleList articles={[]} locale="en" labels={labels} />);

    expect(html).toContain("Nothing here yet.");
  });
});
