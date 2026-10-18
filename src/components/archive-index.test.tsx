import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { ReaderArticleCard } from "@/services/reading";

import { ArchiveIndex } from "./archive-index";

const JUNE: ReaderArticleCard[] = [
  {
    id: "01",
    slug: "hello-world",
    title: "Hello, World",
    summary: "syntax highlighting for a static site",
    publishTime: "2025-06-15T08:30:00.000Z",
    category: { slug: "notes", path: "notes", name: "Notes" },
    cover: { address: "/media/01JUNE/display.webp", width: 1600, height: 1000 },
    tags: [],
  },
  {
    id: "02",
    slug: "loose-end",
    title: "A loose end",
    summary: "",
    publishTime: "2025-06-02T02:00:00.000Z",
    category: null,
    tags: [],
  },
];

describe("the Archive index", () => {
  it("groups a month under its own label and count", () => {
    const html = renderToStaticMarkup(
      <ArchiveIndex months={[{ year: 2025, month: 6, items: JUNE }]} locale="en" />,
    );

    expect(html).toContain('<section class="archive-month">');
    expect(html).toContain("June 2025");
    expect(html).toContain("2 article(s)");
  });

  it("dates each row by its day in the month and links the title", () => {
    const html = renderToStaticMarkup(
      <ArchiveIndex months={[{ year: 2025, month: 6, items: JUNE }]} locale="en" />,
    );

    expect(html).toContain('dateTime="2025-06-15T08:30:00.000Z">15</time>');
    expect(html).toContain('dateTime="2025-06-02T02:00:00.000Z">02</time>');
    expect(html).toContain('href="/en/articles/hello-world"');
    expect(html).toContain("Hello, World");
  });

  it("names the Category beside the title, and nothing when there is none", () => {
    const html = renderToStaticMarkup(
      <ArchiveIndex months={[{ year: 2025, month: 6, items: JUNE }]} locale="en" />,
    );

    expect(html).toContain('class="archive-row-category"');
    expect(html).toContain('href="/en/categories/notes"');
    expect(html.match(/archive-row-category/g)).toHaveLength(1);
  });

  it("shows an index row: no cover, no excerpt", () => {
    const html = renderToStaticMarkup(
      <ArchiveIndex months={[{ year: 2025, month: 6, items: JUNE }]} locale="en" />,
    );

    expect(html).not.toContain("<img");
    expect(html).not.toContain("syntax highlighting for a static site");
  });

  it("keeps the months in the order it was handed them", () => {
    const html = renderToStaticMarkup(
      <ArchiveIndex
        months={[
          { year: 2025, month: 6, items: JUNE.slice(0, 1) },
          { year: 2025, month: 5, items: JUNE.slice(1) },
        ]}
        locale="en"
      />,
    );

    expect(html.indexOf("June 2025")).toBeLessThan(html.indexOf("May 2025"));
  });
});
