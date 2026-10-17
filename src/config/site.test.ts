import { describe, expect, it } from "vitest";
import { isLocale, siteConfig } from "./site";

describe("site configuration", () => {
  it("defines the supported Locales and site timezone once", () => {
    expect(siteConfig.locales).toEqual(["zh", "en"]);
    expect(siteConfig.defaultLocale).toBe("zh");
    expect(siteConfig.timeZone).toBe("Asia/Shanghai");
  });

  it("recognizes only supported Locales", () => {
    expect(isLocale("zh")).toBe(true);
    expect(isLocale("en")).toBe(true);
    expect(isLocale("fr")).toBe(false);
  });
});
