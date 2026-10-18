import { describe, expect, it } from "vitest";

import { ADMIN_ENTRIES, adminEntryFor } from "./admin-entry";

describe("which console entry a path belongs to", () => {
  it("names the entry for each of the six pages", () => {
    expect(ADMIN_ENTRIES).toEqual([
      "dashboard",
      "articles",
      "posts",
      "categories",
      "tags",
      "assets",
    ]);
    for (const entry of ADMIN_ENTRIES) {
      expect(adminEntryFor(entry === "dashboard" ? "/admin" : `/admin/${entry}`), entry).toBe(
        entry,
      );
    }
  });

  it("keeps the entry marked while the Author is inside it", () => {
    expect(adminEntryFor("/admin/articles/01J8ZK")).toBe("articles");
    expect(adminEntryFor("/admin/posts/01J8ZK")).toBe("posts");
    expect(adminEntryFor("/admin/assets/abc/")).toBe("assets");
  });

  it("matches whole segments, so a look-alike path is not the entry", () => {
    // The dashboard is a prefix of everything; only the bare path is it.
    expect(adminEntryFor("/admin/login")).toBeNull();
    expect(adminEntryFor("/admin/articles-archive")).toBeNull();
    expect(adminEntryFor("/elsewhere")).toBeNull();
  });
});
