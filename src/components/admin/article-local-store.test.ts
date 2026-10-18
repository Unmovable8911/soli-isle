import { describe, expect, it } from "vitest";

import {
  createMemoryArticleDraftStore,
  readDraftRecord,
  type PendingArticleEdit,
} from "./article-local-store";

const DRAFT: PendingArticleEdit = {
  articleId: "01J8ZZ",
  locale: "zh",
  title: "Draft",
  summary: "Notes",
  bodyJson: '{"type":"doc"}',
  baseVersion: 3,
  savedAt: "2025-06-15T08:30:00.000Z",
};

describe("article draft store", () => {
  it("round-trips a pending edit per article and locale", async () => {
    const store = createMemoryArticleDraftStore();
    await store.save(DRAFT);

    await expect(store.load("01J8ZZ", "zh")).resolves.toEqual(DRAFT);
    await expect(store.load("01J8ZZ", "en")).resolves.toBeNull();
    await expect(store.load("01J9AA", "zh")).resolves.toBeNull();
  });

  it("replaces the pending edit for the same key", async () => {
    const store = createMemoryArticleDraftStore();
    await store.save(DRAFT);
    await store.save({ ...DRAFT, title: "Newer", baseVersion: 4 });

    await expect(store.load("01J8ZZ", "zh")).resolves.toMatchObject({
      title: "Newer",
      baseVersion: 4,
    });
  });

  it("clears only the key it is given", async () => {
    const store = createMemoryArticleDraftStore();
    await store.save(DRAFT);
    await store.save({ ...DRAFT, locale: "en" });

    await store.clear("01J8ZZ", "zh");

    await expect(store.load("01J8ZZ", "zh")).resolves.toBeNull();
    await expect(store.load("01J8ZZ", "en")).resolves.toMatchObject({ locale: "en" });
  });
});

describe("readDraftRecord", () => {
  it("accepts a complete record written by this version of the editor", () => {
    expect(readDraftRecord({ key: "01J8ZZ:zh", ...DRAFT })).toEqual(DRAFT);
  });

  it("keeps the bytes of a draft written before versions existed but marks the base unknown", () => {
    const legacy = {
      key: "01J8ZZ:zh",
      articleId: "01J8ZZ",
      locale: "zh",
      title: "Draft",
      summary: "Notes",
      bodyJson: '{"type":"doc"}',
      savedAt: "2025-06-15T08:30:00.000Z",
    };

    expect(readDraftRecord(legacy)).toEqual({ ...DRAFT, baseVersion: 0 });
  });

  it("rejects a record that cannot be trusted to hold bytes", () => {
    expect(readDraftRecord(null)).toBeNull();
    expect(readDraftRecord("nonsense")).toBeNull();
    expect(readDraftRecord({ articleId: "01J8ZZ" })).toBeNull();
    expect(readDraftRecord({ ...DRAFT, articleId: 7 })).toBeNull();
    expect(readDraftRecord({ ...DRAFT, title: undefined })).toBeNull();
  });
});
