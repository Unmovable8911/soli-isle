import { describe, expect, it } from "vitest";

import { pickLocalised } from "./localised";

describe("localised names", () => {
  it("prefers the requested locale", () => {
    expect(pickLocalised({ zh: "技术", en: "Tech" }, "en", "fallback")).toBe("Tech");
  });

  it("falls back to the default locale when the requested locale is missing", () => {
    expect(pickLocalised({ zh: "技术" }, "en", "fallback")).toBe("技术");
  });

  it("falls back to the supplied value when no locale matches", () => {
    expect(pickLocalised({}, "en", "fallback")).toBe("fallback");
  });

  it("ignores empty translations", () => {
    expect(pickLocalised({ zh: "", en: "Tech" }, "zh", "fallback")).toBe("Tech");
  });
});
