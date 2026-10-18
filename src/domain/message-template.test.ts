import { describe, expect, it } from "vitest";

import { formatMessage } from "./message-template";

describe("message template", () => {
  it("fills every placeholder from the values", () => {
    expect(formatMessage("{articleCount} Articles and {postCount} Posts", {
      articleCount: 2,
      postCount: 0,
    })).toBe("2 Articles and 0 Posts");
  });

  it("fills the same placeholder everywhere it appears", () => {
    expect(formatMessage("{n} of {n}", { n: 3 })).toBe("3 of 3");
  });

  it("leaves an unknown placeholder visible", () => {
    expect(formatMessage("still {count} left", { other: 1 })).toBe("still {count} left");
  });

  it("returns a template without placeholders unchanged", () => {
    expect(formatMessage("Nothing to fill.", {})).toBe("Nothing to fill.");
  });
});
