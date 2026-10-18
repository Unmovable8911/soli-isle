import { describe, expect, it } from "vitest";

import {
  decodeFeedCursor,
  encodeFeedCursor,
  FEED_PAGE_SIZE,
  FEED_PAGE_SIZE_MAX,
  normaliseFeedPageSize,
  splitFeedPage,
} from "./feed-cursor";

const CURSOR = { publishTime: "2025-06-15T08:30:00.000Z", id: "01JX3Z8Q4A0W7Y6TCVN1KH2M9R" };

describe("feed cursor", () => {
  it("round-trips the Publish Time and the Post id it was taken from", () => {
    expect(decodeFeedCursor(encodeFeedCursor(CURSOR))).toEqual(CURSOR);
  });

  it("stays URL-safe, so it can ride in a query string unchanged", () => {
    const token = encodeFeedCursor(CURSOR);

    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("is opaque enough that a Reader cannot hand-edit the ordering", () => {
    expect(encodeFeedCursor(CURSOR)).not.toContain("2025-06-15");
  });

  it("refuses anything that is not a cursor it produced", () => {
    expect(decodeFeedCursor("")).toBeNull();
    expect(decodeFeedCursor("not-base64-at-all!")).toBeNull();
    expect(decodeFeedCursor(btoaToken("f1|2025-06-15T08:30:00.000Z|not-a-ulid"))).toBeNull();
    expect(decodeFeedCursor(btoaToken("f1|not-a-time|01JX3Z8Q4A0W7Y6TCVN1KH2M9R"))).toBeNull();
    expect(decodeFeedCursor(btoaToken("f2|2025-06-15T08:30:00.000Z|01JX3Z8Q4A0W7Y6TCVN1KH2M9R"))).toBeNull();
    expect(decodeFeedCursor(btoaToken("f1|2025-06-15T08:30:00.000Z"))).toBeNull();
  });
});

describe("feed page size", () => {
  it("defaults when the caller says nothing usable", () => {
    expect(normaliseFeedPageSize(undefined)).toBe(FEED_PAGE_SIZE);
    expect(normaliseFeedPageSize(null)).toBe(FEED_PAGE_SIZE);
    expect(normaliseFeedPageSize("")).toBe(FEED_PAGE_SIZE);
    expect(normaliseFeedPageSize("many")).toBe(FEED_PAGE_SIZE);
    expect(normaliseFeedPageSize("0")).toBe(1);
    expect(normaliseFeedPageSize(-4)).toBe(1);
  });

  it("reads the query-string form and caps what a Reader may ask for", () => {
    expect(normaliseFeedPageSize("7")).toBe(7);
    expect(normaliseFeedPageSize(500)).toBe(FEED_PAGE_SIZE_MAX);
    expect(normaliseFeedPageSize("2.7")).toBe(2);
  });
});

describe("splitting one page off the fetched rows", () => {
  it("keeps the asked-for rows and reports whether anything older is left", () => {
    expect(splitFeedPage(["a", "b", "c"], 2)).toEqual({ page: ["a", "b"], hasMore: true });
    expect(splitFeedPage(["a", "b"], 2)).toEqual({ page: ["a", "b"], hasMore: false });
    expect(splitFeedPage([], 2)).toEqual({ page: [], hasMore: false });
  });
});

/** Base64url is what `encodeFeedCursor` emits; this makes an invalid token look well-formed. */
function btoaToken(payload: string): string {
  return Buffer.from(payload, "utf8").toString("base64url");
}
