import { describe, expect, it } from "vitest";

import {
  categoryAncestorPaths,
  categoryPathSegments,
  isWithinCategoryPath,
} from "./category-path";

describe("category path", () => {
  it("splits a locale-neutral path into its segments", () => {
    expect(categoryPathSegments("notes/tools/editor")).toEqual(["notes", "tools", "editor"]);
  });

  it("ignores empty segments so a stray slash cannot create a level", () => {
    expect(categoryPathSegments("/notes//tools/")).toEqual(["notes", "tools"]);
    expect(categoryPathSegments("")).toEqual([]);
  });

  it("builds one breadcrumb per level, each carrying its own accumulated path", () => {
    expect(categoryAncestorPaths("notes/tools/editor")).toEqual([
      { path: "notes", slug: "notes" },
      { path: "notes/tools", slug: "tools" },
      { path: "notes/tools/editor", slug: "editor" },
    ]);
  });

  it("has no breadcrumbs for the root", () => {
    expect(categoryAncestorPaths("")).toEqual([]);
  });
});

describe("category containment", () => {
  it("counts a category as within itself and within its ancestors", () => {
    expect(isWithinCategoryPath("notes/tools", "notes")).toBe(true);
    expect(isWithinCategoryPath("notes/tools", "notes/tools")).toBe(true);
  });

  it("does not treat a shared prefix as a child", () => {
    expect(isWithinCategoryPath("notes-tools", "notes")).toBe(false);
    expect(isWithinCategoryPath("notes", "notes/tools")).toBe(false);
  });
});
