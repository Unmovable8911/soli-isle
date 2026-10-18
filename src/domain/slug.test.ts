import { describe, expect, it } from "vitest";

import { isSafeSlug, normaliseSlug, uniqueSlug } from "./slug";

describe("slug normalisation", () => {
  it("lowercases and hyphenates words", () => {
    expect(normaliseSlug("Hello, World!")).toBe("hello-world");
  });

  it("strips accents but keeps the base letters", () => {
    expect(normaliseSlug("Crème Brûlée")).toBe("creme-brulee");
  });

  it("collapses separator runs and trims the edges", () => {
    expect(normaliseSlug("  --a   b--  ")).toBe("a-b");
  });

  it("drops characters that cannot appear in a URL path", () => {
    expect(normaliseSlug("what?/why#now")).toBe("what-why-now");
  });

  it("keeps non-latin letters so a Chinese title still yields a slug", () => {
    expect(normaliseSlug("中文标题")).toBe("中文标题");
  });

  it("leaves nothing behind when nothing usable remains", () => {
    expect(normaliseSlug("!!! ??? ...")).toBe("");
  });

  it("caps the length without leaving a trailing separator", () => {
    const slug = normaliseSlug("a".repeat(200));

    expect(slug).toHaveLength(96);
    expect(slug.endsWith("-")).toBe(false);
  });
});

describe("slug safety", () => {
  it("accepts normalised slugs", () => {
    expect(isSafeSlug("first-post")).toBe(true);
    expect(isSafeSlug("中文标题")).toBe(true);
  });

  it("rejects empty, over-long or separator-bearing slugs", () => {
    for (const value of ["", "a/b", "a b", "-a", "a-", "a".repeat(97)]) {
      expect(isSafeSlug(value)).toBe(false);
    }
  });
});

describe("unique slug", () => {
  it("keeps a free slug unchanged", () => {
    expect(uniqueSlug("first-post", () => false)).toBe("first-post");
  });

  it("numbers colliding slugs", () => {
    const taken = new Set(["first-post", "first-post-2"]);

    expect(uniqueSlug("first-post", (candidate) => taken.has(candidate))).toBe("first-post-3");
  });

  it("falls back to a usable slug when the base normalises to nothing", () => {
    const slug = uniqueSlug(normaliseSlug("!!!"), () => false);

    expect(slug.length).toBeGreaterThan(0);
    expect(isSafeSlug(slug)).toBe(true);
  });
});
