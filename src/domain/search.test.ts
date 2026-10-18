import { describe, expect, it } from "vitest";

import { escapeLikeTerm, highlightSegments, matchSnippet, parseSearchTerms } from "./search";

describe("search terms", () => {
  it("splits on whitespace and keeps the reader's own casing", () => {
    expect(parseSearchTerms("  Hello   world  ")).toEqual(["Hello", "world"]);
  });

  it("drops repeats regardless of case and caps the term count", () => {
    expect(parseSearchTerms("Hello hello HELLO")).toEqual(["Hello"]);
    expect(parseSearchTerms("a b c d e f g h i j")).toHaveLength(8);
  });

  it("keeps a space-free phrase such as a Chinese keyword whole", () => {
    expect(parseSearchTerms("中文搜索")).toEqual(["中文搜索"]);
  });

  it("treats an empty or whitespace-only query as no terms", () => {
    expect(parseSearchTerms("")).toEqual([]);
    expect(parseSearchTerms("   ")).toEqual([]);
  });
});

describe("highlighting", () => {
  it("marks every occurrence without losing the surrounding text", () => {
    expect(highlightSegments("Hello world hello", ["hello"])).toEqual([
      { text: "Hello", match: true },
      { text: " world ", match: false },
      { text: "hello", match: true },
    ]);
  });

  it("marks a keyword inside Chinese text, which has no word boundaries", () => {
    expect(highlightSegments("一段中文内容供搜索", ["内容"])).toEqual([
      { text: "一段中文", match: false },
      { text: "内容", match: true },
      { text: "供搜索", match: false },
    ]);
  });

  it("merges overlapping and adjacent matches into one mark", () => {
    expect(highlightSegments("abc", ["ab", "bc"])).toEqual([{ text: "abc", match: true }]);
    expect(highlightSegments("abcd", ["ab", "cd"])).toEqual([{ text: "abcd", match: true }]);
  });

  it("returns the whole text unmarked when nothing matches", () => {
    expect(highlightSegments("nothing here", ["absent"])).toEqual([
      { text: "nothing here", match: false },
    ]);
  });

  it("ignores blank terms and blank text", () => {
    expect(highlightSegments("text", ["", " "])).toEqual([{ text: "text", match: false }]);
    expect(highlightSegments("", ["text"])).toEqual([]);
  });
});

describe("snippets", () => {
  const LONG = `first paragraph without the word. ${"filler ".repeat(30)}the needle sits here in the middle of the body. ${"tail ".repeat(30)}last words`;

  it("cuts a window around the first match and marks the ellipses", () => {
    const snippet = matchSnippet(LONG, ["needle"]);
    expect(snippet).not.toBeNull();
    expect(snippet).toContain("the needle sits here");
    expect(snippet?.startsWith("…")).toBe(true);
    expect(snippet?.endsWith("…")).toBe(true);
    expect(snippet?.length).toBeLessThan(LONG.length);
  });

  it("flattens line breaks so the snippet is one line of prose", () => {
    expect(matchSnippet("first line\n\nsecond line with needle", ["needle"])).toBe(
      "first line second line with needle",
    );
  });

  it("picks the earliest of several terms, and is null when none matches", () => {
    expect(matchSnippet("aaa needle one, needle two", ["two", "one"])).toContain("needle one");
    expect(matchSnippet("nothing here", ["absent"])).toBeNull();
    expect(matchSnippet("", ["absent"])).toBeNull();
  });
});

describe("like patterns", () => {
  it("escapes the wildcards a reader could type", () => {
    expect(escapeLikeTerm("50%_off\\")).toBe("50\\%\\_off\\\\");
  });

  it("leaves ordinary keywords untouched", () => {
    expect(escapeLikeTerm("highlight")).toBe("highlight");
  });
});
