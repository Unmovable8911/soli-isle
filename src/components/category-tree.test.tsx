import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { ReaderCategoryNode } from "@/services/reading";

import { CategoryTree } from "./category-tree";

const TREE: ReaderCategoryNode[] = [
  {
    id: "01",
    slug: "tech",
    path: "tech",
    name: "Technology",
    count: 3,
    children: [
      {
        id: "02",
        slug: "web",
        path: "tech/web",
        name: "Web Development",
        count: 2,
        children: [
          {
            id: "03",
            slug: "css",
            path: "tech/web/css",
            name: "Cascading Style Sheets",
            count: 1,
            children: [],
          },
        ],
      },
    ],
  },
  {
    id: "04",
    slug: "life",
    path: "life",
    name: "A very long Category name that has to wrap rather than truncate",
    count: 1,
    children: [],
  },
];

function render(currentPath: string | null): string {
  return renderToStaticMarkup(
    <CategoryTree locale="en" heading="Categories" nodes={TREE} currentPath={currentPath} />,
  );
}

describe("the Category tree", () => {
  it("links every Category, at every depth, to its own page", () => {
    const html = render(null);

    for (const href of ["/en/categories/tech", "/en/categories/tech/web", "/en/categories/tech/web/css", "/en/categories/life"]) {
      expect(html).toContain(`href="${href}"`);
    }
  });

  it("nests a child list inside its parent's item, so the level is structure and not a guessed margin", () => {
    const html = render(null);

    expect(html).toContain("Technology");
    // The child list is inside the parent <li>, after the parent's own link.
    expect(html).toMatch(/<li[^>]*>[\s\S]*?Technology<\/a>[\s\S]*?<ul class="site-tree">[\s\S]*?Web Development/);
    // One list per level with children, so no flat list carries an inline width.
    expect(html.match(/<ul class="site-tree">/g)).toHaveLength(3);
    expect(html).not.toContain("style=");
  });

  it("marks the current Category, and only the current Category", () => {
    const html = render("tech/web");

    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
    const [current] = html.match(/<a[^>]*aria-current="page"[^>]*>/g) ?? [];
    expect(current).toContain('href="/en/categories/tech/web"');
    expect(current).not.toContain('href="/en/categories/tech"');
  });

  it("marks nothing when the page is not a Category page", () => {
    expect(render(null)).not.toContain("aria-current");
  });

  it("renders a Category name whole, so CSS can wrap it", () => {
    const html = render(null);

    expect(html).toContain("A very long Category name that has to wrap rather than truncate");
  });
});
