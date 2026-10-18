import { describe, expect, it } from "vitest";

import { messages } from "@/messages";

import { categoryDeleteNotice, tagDeleteNotice } from "./catalogue-notices";

const categories = messages.zh.admin.categories;
const tags = messages.zh.admin.tags;

describe("category delete notice", () => {
  it("says how many child Categories are still there", () => {
    expect(categoryDeleteNotice(categories, { error: "has-children", childCount: 3 })).toBe(
      "它下面还有 3 个子分类，请先把它们移走或删除。",
    );
  });

  it("says how many Articles are still filed under it", () => {
    expect(categoryDeleteNotice(categories, { error: "in-use", articleCount: 2 })).toBe(
      "有 2 篇长文属于它。请先选择要把这些长文移到哪个分类。",
    );
  });

  it("falls back to the generic failure for anything else", () => {
    expect(categoryDeleteNotice(categories, { error: "not-found" })).toBe(categories.delete.failed);
    expect(categoryDeleteNotice(categories, null)).toBe(categories.delete.failed);
    expect(categoryDeleteNotice(categories, { error: "in-use" })).toBe(categories.delete.failed);
  });
});

describe("tag delete notice", () => {
  it("reports both kinds of use", () => {
    expect(tagDeleteNotice(tags, { error: "in-use", articleCount: 4, postCount: 2 })).toBe(
      "有 4 篇长文和 2 篇推文在用这个标签，请先在这些内容里取消关联。",
    );
  });

  it("falls back to the generic failure when a count is missing", () => {
    expect(tagDeleteNotice(tags, { error: "in-use", articleCount: 1 })).toBe(tags.deleteFailed);
    expect(tagDeleteNotice(tags, { error: "not-found" })).toBe(tags.deleteFailed);
  });
});
