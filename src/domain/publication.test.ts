import { describe, expect, it } from "vitest";

import {
  isIndexable,
  isReadableByUrl,
  isPublicationState,
  isVisibleToReader,
  publicationVisibility,
} from "./publication";

const NOW = new Date("2025-06-15T08:30:00.000Z");
const PAST = "2025-06-15T08:29:59.000Z";
const EXACTLY_NOW = "2025-06-15T08:30:00.000Z";
const FUTURE = "2025-06-15T08:30:01.000Z";

describe("publication visibility", () => {
  it("hides a draft even when it carries a publish time in the past", () => {
    expect(publicationVisibility({ state: "draft", publishTime: PAST }, NOW)).toBe("draft");
  });

  it("reports a draft as draft even when it carries a future publish time", () => {
    const publication = { state: "draft" as const, publishTime: FUTURE };

    expect(publicationVisibility(publication, NOW)).toBe("draft");
    expect(isVisibleToReader(publication, NOW)).toBe(false);
    expect(isReadableByUrl(publication, NOW)).toBe(false);
  });

  it("makes a published article without a publish time visible", () => {
    expect(publicationVisibility({ state: "published", publishTime: null }, NOW)).toBe("visible");
  });

  it("keeps a published article hidden until the site clock reaches its publish time", () => {
    const publication = { state: "published" as const, publishTime: FUTURE };

    expect(isVisibleToReader(publication, NOW)).toBe(false);
    expect(isVisibleToReader(publication, new Date(FUTURE))).toBe(true);
  });

  it("makes a published article visible at exactly its publish time", () => {
    expect(
      publicationVisibility({ state: "published", publishTime: EXACTLY_NOW }, NOW),
    ).toBe("visible");
  });

  it("makes a published article visible once its publish time has passed", () => {
    expect(publicationVisibility({ state: "published", publishTime: PAST }, NOW)).toBe("visible");
  });

  it("hides an archived article from readers and lists while keeping its URL reachable", () => {
    const publication = { state: "archived" as const, publishTime: PAST };

    expect(publicationVisibility(publication, NOW)).toBe("archived");
    expect(isVisibleToReader(publication, NOW)).toBe(false);
    expect(isReadableByUrl(publication, NOW)).toBe(true);
    expect(isIndexable(publication, NOW)).toBe(false);
  });

  it("only treats a visible article as indexable", () => {
    expect(isIndexable({ state: "published", publishTime: PAST }, NOW)).toBe(true);
    expect(isIndexable({ state: "draft", publishTime: PAST }, NOW)).toBe(false);
    expect(isIndexable({ state: "published", publishTime: FUTURE }, NOW)).toBe(false);
  });

  it("recognises the three publication states and nothing else", () => {
    expect(isPublicationState("draft")).toBe(true);
    expect(isPublicationState("published")).toBe(true);
    expect(isPublicationState("archived")).toBe(true);
    expect(isPublicationState("scheduled")).toBe(false);
    expect(isPublicationState("deleted")).toBe(false);
  });
});
