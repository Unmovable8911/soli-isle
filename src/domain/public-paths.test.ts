import { describe, expect, it } from "vitest";

import {
  buildArchivePath,
  buildCategoryIndexPath,
  buildCategoryPath,
  buildHomePath,
  buildSearchPath,
  buildTagPath,
  parseCategoryPath,
  parseTagPath,
} from "./public-paths";

describe("reader paths", () => {
  it("builds the locale-scoped entry points", () => {
    expect(buildHomePath("zh")).toBe("/zh");
    expect(buildCategoryIndexPath("en")).toBe("/en/archive#categories");
    expect(buildArchivePath("zh")).toBe("/zh/archive");
  });

  it("keeps every Category level in the URL", () => {
    expect(buildCategoryPath({ locale: "zh", categoryPath: "notes/tools" })).toBe(
      "/zh/categories/notes/tools",
    );
    expect(buildCategoryIndexPath("zh")).toBe(buildCategoryPath({ locale: "zh", categoryPath: "" }));
  });

  it("percent-encodes each segment so a slug with a space still round-trips", () => {
    const path = buildCategoryPath({ locale: "en", categoryPath: "my notes/tools" });
    expect(path).toBe("/en/categories/my%20notes/tools");
    expect(parseCategoryPath(path)).toEqual({ locale: "en", categoryPath: "my notes/tools" });
  });

  it("parses the category index and nested levels, tolerating a trailing slash", () => {
    expect(parseCategoryPath("/zh/categories")).toEqual({ locale: "zh", categoryPath: "" });
    expect(parseCategoryPath("/zh/categories/")).toEqual({ locale: "zh", categoryPath: "" });
    expect(parseCategoryPath("/zh/categories/notes/tools/")).toEqual({
      locale: "zh",
      categoryPath: "notes/tools",
    });
  });

  it("rejects a path that is not a category page", () => {
    expect(parseCategoryPath("/zh/tags/notes")).toBeNull();
    expect(parseCategoryPath("/fr/categories/notes")).toBeNull();
    expect(parseCategoryPath("/categories")).toBeNull();
  });

  it("builds and parses Tag paths", () => {
    expect(buildTagPath({ locale: "zh", slug: "编辑器" })).toBe(
      "/zh/tags/%E7%BC%96%E8%BE%91%E5%99%A8",
    );
    expect(parseTagPath("/zh/tags/%E7%BC%96%E8%BE%91%E5%99%A8")).toEqual({
      locale: "zh",
      slug: "编辑器",
    });
    expect(parseTagPath("/zh/categories/notes")).toBeNull();
  });

  it("omits the query string when the search box is empty", () => {
    expect(buildSearchPath({ locale: "zh", query: "" })).toBe("/zh/search");
    expect(buildSearchPath({ locale: "zh", query: "  " })).toBe("/zh/search");
    expect(buildSearchPath({ locale: "en", query: "syntax highlight" })).toBe(
      "/en/search?q=syntax+highlight",
    );
  });
});
