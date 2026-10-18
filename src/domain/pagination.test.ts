import { describe, expect, it } from "vitest";

import { pageCountOf, paginate, parsePageNumber } from "./pagination";

describe("parsePageNumber", () => {
  it("falls back to the first page for anything that is not a positive integer", () => {
    expect(parsePageNumber(undefined)).toBe(1);
    expect(parsePageNumber("")).toBe(1);
    expect(parsePageNumber("0")).toBe(1);
    expect(parsePageNumber("-2")).toBe(1);
    expect(parsePageNumber("abc")).toBe(1);
    expect(parsePageNumber("2.5")).toBe(1);
    expect(parsePageNumber("1e3")).toBe(1);
  });

  it("reads a positive integer, trimming the padding a URL may carry", () => {
    expect(parsePageNumber("2")).toBe(2);
    expect(parsePageNumber(" 3 ")).toBe(3);
    expect(parsePageNumber("12")).toBe(12);
  });

  it("takes the first value when the parameter repeats", () => {
    expect(parsePageNumber(["4", "9"])).toBe(4);
    expect(parsePageNumber(["abc", "9"])).toBe(1);
    expect(parsePageNumber([])).toBe(1);
  });
});

describe("pageCountOf", () => {
  it("never reports fewer than one page", () => {
    expect(pageCountOf(0, 10)).toBe(1);
    expect(pageCountOf(-5, 10)).toBe(1);
    expect(pageCountOf(10, 0)).toBe(1);
    expect(pageCountOf(0, 0)).toBe(1);
  });

  it("counts a partial last page", () => {
    expect(pageCountOf(1, 10)).toBe(1);
    expect(pageCountOf(10, 10)).toBe(1);
    expect(pageCountOf(11, 10)).toBe(2);
    expect(pageCountOf(20, 10)).toBe(2);
    expect(pageCountOf(21, 10)).toBe(3);
    expect(pageCountOf(3, 2)).toBe(2);
  });
});

describe("paginate", () => {
  const items = ["a", "b", "c", "d", "e"];

  it("slices the requested page", () => {
    expect(paginate(items, 1, 2)).toEqual({ items: ["a", "b"], page: 1, pageCount: 3 });
    expect(paginate(items, 2, 2)).toEqual({ items: ["c", "d"], page: 2, pageCount: 3 });
    expect(paginate(items, 3, 2)).toEqual({ items: ["e"], page: 3, pageCount: 3 });
  });

  it("clamps a page below the first and above the last", () => {
    expect(paginate(items, 0, 2)).toEqual({ items: ["a", "b"], page: 1, pageCount: 3 });
    expect(paginate(items, -4, 2)).toEqual({ items: ["a", "b"], page: 1, pageCount: 3 });
    expect(paginate(items, 99, 2)).toEqual({ items: ["e"], page: 3, pageCount: 3 });
  });

  it("keeps the first page for an empty listing", () => {
    expect(paginate([], 4, 10)).toEqual({ items: [], page: 1, pageCount: 1 });
  });

  it("returns nothing at all when the page size is not positive", () => {
    expect(paginate(items, 2, 0)).toEqual({ items: [], page: 1, pageCount: 1 });
    expect(paginate(items, 2, -3)).toEqual({ items: [], page: 1, pageCount: 1 });
  });
});
