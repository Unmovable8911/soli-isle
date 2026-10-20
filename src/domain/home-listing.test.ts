import { describe, expect, it } from "vitest";

import { firstQueryValue, resolveCategoryPath } from "./home-listing";

describe("firstQueryValue", () => {
  it("passes a single value through", () => {
    expect(firstQueryValue("notes")).toBe("notes");
  });

  it("has nothing for an absent param", () => {
    expect(firstQueryValue(undefined)).toBeUndefined();
  });

  it("takes the first value of a repeated param, because a mangled URL is not an ambiguous one", () => {
    expect(firstQueryValue(["notes", "life"])).toBe("notes");
  });

  it("has nothing for a param that repeats with no values at all", () => {
    expect(firstQueryValue([])).toBeUndefined();
  });
});

describe("resolveCategoryPath", () => {
  /** The top-level Category paths a Home request is matched against. */
  const paths = ["notes", "notes/tools", "life"];

  it("means Latest when the param is absent", () => {
    expect(resolveCategoryPath(paths, undefined)).toBeNull();
  });

  it("means Latest when the param is empty", () => {
    expect(resolveCategoryPath(paths, "")).toBeNull();
  });

  it("resolves a known path to the entry the tree carries", () => {
    expect(resolveCategoryPath(paths, "notes/tools")).toBe("notes/tools");
  });

  it("means Latest for a path that names no Category", () => {
    expect(resolveCategoryPath(paths, "unknown")).toBeNull();
  });

  it("means Latest when the tree has no Categories at all", () => {
    expect(resolveCategoryPath([], "notes")).toBeNull();
  });

  it("reads a repeated param the way it reads a single one", () => {
    expect(resolveCategoryPath(paths, ["life", "notes"])).toBe("life");
  });

  it("means Latest when the first value of a repeated param names no Category", () => {
    expect(resolveCategoryPath(paths, ["unknown", "notes"])).toBeNull();
  });

  it("means Latest when the param repeats with no values at all", () => {
    expect(resolveCategoryPath(paths, [])).toBeNull();
  });
});
