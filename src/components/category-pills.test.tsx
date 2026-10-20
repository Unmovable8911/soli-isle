import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { ReaderCategoryNode } from "@/services/reading";

import { CategoryPills } from "./category-pills";

const NODES: ReaderCategoryNode[] = [
  { id: "01", slug: "notes", path: "notes", name: "Notes", count: 4, children: [] },
  { id: "02", slug: "tools", path: "notes/tools", name: "Tools", count: 0, children: [] },
];

describe("the Category pills", () => {
  it("links each Category where it lives and says how much is in it", () => {
    const html = renderToStaticMarkup(<CategoryPills categories={NODES} locale="en" />);

    expect(html).toContain('href="/en/categories/notes"');
    expect(html).toContain('href="/en/categories/notes/tools"');
    expect(html).toContain("Notes");
    expect(html).toContain("4");
  });

  it("keeps the row a list of pills, not a sentence", () => {
    const html = renderToStaticMarkup(<CategoryPills categories={NODES} locale="zh" />);

    expect(html).toContain('<ul class="reader-pills">');
    expect(html.match(/<li class="reader-pill">/g)).toHaveLength(2);
  });
});
