import { describe, expect, it } from "vitest";

import { POST_FOLD_MAX_HEIGHT_PX, postBodyShouldFold } from "./post-fold";

describe("post body fold decision", () => {
  it("leaves a short body unfolded", () => {
    expect(postBodyShouldFold(0)).toBe(false);
    expect(postBodyShouldFold(120)).toBe(false);
  });

  it("folds a body that measurably overflows the collapsed height", () => {
    expect(postBodyShouldFold(POST_FOLD_MAX_HEIGHT_PX + 40)).toBe(true);
  });

  it("does not fold on a sub-pixel overflow, which a zoomed layout produces on its own", () => {
    expect(postBodyShouldFold(POST_FOLD_MAX_HEIGHT_PX)).toBe(false);
    expect(postBodyShouldFold(POST_FOLD_MAX_HEIGHT_PX + 1)).toBe(false);
    expect(postBodyShouldFold(POST_FOLD_MAX_HEIGHT_PX + 2)).toBe(true);
  });

  it("takes the threshold from the caller when the layout asks for another one", () => {
    expect(postBodyShouldFold(200, 160)).toBe(true);
    expect(postBodyShouldFold(150, 160)).toBe(false);
  });

  it("never folds when there is no usable measurement", () => {
    expect(postBodyShouldFold(Number.NaN)).toBe(false);
    expect(postBodyShouldFold(-1)).toBe(false);
  });
});
