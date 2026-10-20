import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * The Article page reads the database and renders through one view component,
 * so what this file holds it to is the wiring the design names: the breadcrumb
 * the shell keeps on a long form page, above the piece and inside the same
 * Category journey the Category page draws.
 */
const PAGE = path.resolve(process.cwd(), "src/app/[locale]/articles/[slug]/page.tsx");

function source(): string {
  return readFileSync(PAGE, "utf8");
}

describe("the Article page", () => {
  it("puts the breadcrumb above the piece", () => {
    const text = source();

    expect(text).toContain('import { Breadcrumbs } from "@/components/breadcrumbs"');
    expect(text).toContain("<Breadcrumbs");
    expect(text).toContain("t.reader.breadcrumb.label");
    expect(text.indexOf("<Breadcrumbs")).toBeLessThan(text.indexOf("<ArticleView"));
  });

  it("walks the Category path the Article is filed under", () => {
    const text = source();

    // The Category index is the root crumb; the Article's own Category is the
    // link just above its title, exactly where the Category page puts it.
    expect(text).toContain("buildCategoryIndexPath(locale)");
    expect(text).toContain("buildCategoryPath({");
    expect(text).toContain("article.category");
  });
});
