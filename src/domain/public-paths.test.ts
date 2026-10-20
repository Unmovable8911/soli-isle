import { describe, expect, it } from "vitest";

import {
  buildArchivePath,
  buildCategoryIndexPath,
  buildCategoryPath,
  buildHomeListingPath,
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

  it("builds the home listing URL, leaving out what is not there", () => {
    expect(buildHomeListingPath({ locale: "en" })).toBe("/en");
    expect(buildHomeListingPath({ locale: "en", categoryPath: null })).toBe("/en");
    expect(buildHomeListingPath({ locale: "en", categoryPath: "notes" })).toBe("/en?category=notes");
    expect(buildHomeListingPath({ locale: "en", page: 3 })).toBe("/en?page=3");
    expect(buildHomeListingPath({ locale: "zh", categoryPath: "notes/tools" })).toBe(
      "/zh?category=notes%2Ftools",
    );
    expect(buildHomeListingPath({ locale: "zh", categoryPath: "notes/tools", page: 2 })).toBe(
      "/zh?category=notes%2Ftools&page=2",
    );
  });

  it("round-trips a Category path through the query the way the page reads it", () => {
    const read = (path: string) =>
      new URL(`https://example.com${path}`).searchParams.get("category");

    expect(read(buildHomeListingPath({ locale: "en", categoryPath: "my notes/tools" }))).toBe(
      "my notes/tools",
    );
    expect(read(buildHomeListingPath({ locale: "zh", categoryPath: "编辑器/工具" }))).toBe(
      "编辑器/工具",
    );
    expect(read(buildHomeListingPath({ locale: "en", categoryPath: "notes" }))).toBe("notes");
    expect(read(buildHomeListingPath({ locale: "en", categoryPath: "notes/tools" }))).toBe(
      "notes/tools",
    );
    expect(
      read(buildHomeListingPath({ locale: "en", categoryPath: "my notes/tools", page: 2 })),
    ).toBe("my notes/tools");
  });

  it("normalises leading, trailing and doubled slashes into one path", () => {
    expect(buildHomeListingPath({ locale: "en", categoryPath: "/notes//tools/" })).toBe(
      "/en?category=notes%2Ftools",
    );
    expect(buildHomeListingPath({ locale: "zh", categoryPath: "///" })).toBe("/zh");
  });

  it("drops a page of 1 or less so the bare listing stays the canonical URL", () => {
    expect(buildHomeListingPath({ locale: "zh", page: 1 })).toBe("/zh");
    expect(buildHomeListingPath({ locale: "zh", page: 0 })).toBe("/zh");
    expect(buildHomeListingPath({ locale: "zh", page: -2 })).toBe("/zh");
    expect(buildHomeListingPath({ locale: "zh", categoryPath: "", page: 1 })).toBe("/zh");
  });

  it("omits the query string when the search box is empty", () => {
    expect(buildSearchPath({ locale: "zh", query: "" })).toBe("/zh/search");
    expect(buildSearchPath({ locale: "zh", query: "  " })).toBe("/zh/search");
    expect(buildSearchPath({ locale: "en", query: "syntax highlight" })).toBe(
      "/en/search?q=syntax+highlight",
    );
  });
});
