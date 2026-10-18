import { describe, expect, it } from "vitest";

import { buildArticlePath, parseArticlePath } from "./article-url";

describe("article URL", () => {
  it("builds a locale-prefixed path from a slug", () => {
    expect(buildArticlePath({ locale: "zh", slug: "first-post" })).toBe("/zh/articles/first-post");
  });

  it("percent-encodes a non-ASCII slug", () => {
    expect(buildArticlePath({ locale: "en", slug: "中文" })).toBe(
      "/en/articles/%E4%B8%AD%E6%96%87",
    );
  });

  it("parses a path back into its locale and slug", () => {
    expect(parseArticlePath("/zh/articles/first-post")).toEqual({
      locale: "zh",
      slug: "first-post",
    });
  });

  it("decodes a percent-encoded slug", () => {
    expect(parseArticlePath("/en/articles/%E4%B8%AD%E6%96%87")).toEqual({
      locale: "en",
      slug: "中文",
    });
  });

  it("tolerates a trailing slash", () => {
    expect(parseArticlePath("/zh/articles/first-post/")).toEqual({
      locale: "zh",
      slug: "first-post",
    });
  });

  it("returns null for paths that are not article URLs", () => {
    for (const path of [
      "/zh",
      "/zh/articles",
      "/zh/articles/",
      "/zh/posts/first-post",
      "/zh/articles/first-post/edit",
      "/articles/first-post",
      "/fr/articles/first-post",
    ]) {
      expect(parseArticlePath(path)).toBeNull();
    }
  });

  it("round-trips every configured locale", () => {
    for (const locale of ["zh", "en"] as const) {
      const path = buildArticlePath({ locale, slug: "round-trip" });
      expect(parseArticlePath(path)).toEqual({ locale, slug: "round-trip" });
    }
  });
});
