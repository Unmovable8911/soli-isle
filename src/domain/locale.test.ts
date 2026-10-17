import { describe, expect, it } from "vitest";
import {
  decideLocaleRedirect,
  isLanguageTagLike,
  localeFromPathname,
  negotiateLocale,
  parseAcceptLanguage,
  swapLocalePathname,
  withLocalePrefix,
} from "./locale";

describe("parseAcceptLanguage", () => {
  it("returns no entries for a missing header", () => {
    expect(parseAcceptLanguage(null)).toEqual([]);
  });

  it("keeps each tag verbatim and defaults missing q to 1", () => {
    expect(parseAcceptLanguage("zh-CN, zh;q=0.9, en")).toEqual([
      { tag: "zh-CN", q: 1 },
      { tag: "en", q: 1 },
      { tag: "zh", q: 0.9 },
    ]);
  });

  it("sorts by q descending and stays stable on equal q", () => {
    expect(parseAcceptLanguage("en;q=0.8, zh;q=0.8, fr;q=0.9")).toEqual([
      { tag: "fr", q: 0.9 },
      { tag: "en", q: 0.8 },
      { tag: "zh", q: 0.8 },
    ]);
  });

  it("excludes entries with q=0", () => {
    expect(parseAcceptLanguage("en;q=0, zh;q=0.5")).toEqual([{ tag: "zh", q: 0.5 }]);
  });

  it("excludes entries whose q is not a number in [0, 1]", () => {
    expect(parseAcceptLanguage("en;q=1.5, zh;q=abc, fr;q=-0.1, de;q=0.9")).toEqual([
      { tag: "de", q: 0.9 },
    ]);
  });

  it("ignores case in q and surrounding whitespace", () => {
    expect(parseAcceptLanguage("  zh-CN , EN ; Q=0.9 ")).toEqual([
      { tag: "zh-CN", q: 1 },
      { tag: "EN", q: 0.9 },
    ]);
  });
});

describe("negotiateLocale", () => {
  it("returns the cookie-chosen Locale when it is supported", () => {
    expect(negotiateLocale("en", "zh")).toBe("zh");
    expect(negotiateLocale(null, "en")).toBe("en");
  });

  it("ignores a cookie value that is not a supported Locale", () => {
    expect(negotiateLocale("en", "fr")).toBe("en");
    expect(negotiateLocale("en", "")).toBe("en");
  });

  it("matches the primary subtag of a regional tag, case-insensitively", () => {
    expect(negotiateLocale("zh-CN", null)).toBe("zh");
    expect(negotiateLocale("EN-us", null)).toBe("en");
  });

  it("never picks a language the reader marked unacceptable", () => {
    expect(negotiateLocale("en;q=0, zh;q=0.8", null)).toBe("zh");
  });

  it("treats the wildcard as the default Locale", () => {
    expect(negotiateLocale("fr, *;q=0.5", null)).toBe("zh");
  });

  it("falls back to the default Locale when nothing matches", () => {
    expect(negotiateLocale("fr-FR", null)).toBe("zh");
    expect(negotiateLocale(null, null)).toBe("zh");
  });
});

describe("isLanguageTagLike", () => {
  it("accepts two- and three-letter primary subtags with an optional subtag", () => {
    expect(isLanguageTagLike("zh")).toBe(true);
    expect(isLanguageTagLike("en-US")).toBe(true);
    expect(isLanguageTagLike("yue")).toBe(true);
    expect(isLanguageTagLike("zh-Hans")).toBe(true);
    expect(isLanguageTagLike("zh-Hant")).toBe(true);
    expect(isLanguageTagLike("zh-Hant-TW")).toBe(true);
    expect(isLanguageTagLike("zh-cn")).toBe(true);
  });

  it("rejects segments outside the language tag shape", () => {
    expect(isLanguageTagLike("e")).toBe(false);
    expect(isLanguageTagLike("zh-")).toBe(false);
    expect(isLanguageTagLike("about")).toBe(false);
    expect(isLanguageTagLike("")).toBe(false);
    expect(isLanguageTagLike("123")).toBe(false);
  });
});

describe("localeFromPathname", () => {
  it("returns the Locale in the first segment", () => {
    expect(localeFromPathname("/zh/foo")).toBe("zh");
    expect(localeFromPathname("/zh")).toBe("zh");
    expect(localeFromPathname("/en")).toBe("en");
  });

  it("returns null when the first segment is not a supported Locale", () => {
    expect(localeFromPathname("/en-US")).toBeNull();
    expect(localeFromPathname("/about")).toBeNull();
    expect(localeFromPathname("/")).toBeNull();
    expect(localeFromPathname("")).toBeNull();
  });
});

describe("withLocalePrefix", () => {
  it("prefixes a bare path with the given Locale", () => {
    expect(withLocalePrefix("/", "en")).toBe("/en");
    expect(withLocalePrefix("/", "zh")).toBe("/zh");
    expect(withLocalePrefix("/about", "en")).toBe("/en/about");
    expect(withLocalePrefix("/about/", "en")).toBe("/en/about/");
  });
});

describe("swapLocalePathname", () => {
  it("replaces only the Locale prefix", () => {
    expect(swapLocalePathname("/zh/foo", "en")).toBe("/en/foo");
    expect(swapLocalePathname("/zh", "en")).toBe("/en");
    expect(swapLocalePathname("/zh/", "en")).toBe("/en/");
    expect(swapLocalePathname("/en/zh", "zh")).toBe("/zh/zh");
  });

  it("prepends the target Locale when the path has no prefix", () => {
    expect(swapLocalePathname("/about", "en")).toBe("/en/about");
    expect(swapLocalePathname("/", "en")).toBe("/en/");
  });
});

describe("decideLocaleRedirect", () => {
  it("redirects bare and unprefixed page paths to the negotiated Locale", () => {
    expect(decideLocaleRedirect("/", "en", null)).toBe("en");
    expect(decideLocaleRedirect("/about", "en", null)).toBe("en");
    expect(decideLocaleRedirect("/about/", "en", null)).toBe("en");
  });

  it("prefers the cookie choice on bare paths", () => {
    expect(decideLocaleRedirect("/", "en", "zh")).toBe("zh");
  });

  it("never rewrites a supported Locale prefix", () => {
    expect(decideLocaleRedirect("/zh", "en", null)).toBeNull();
    expect(decideLocaleRedirect("/zh/foo", "en", null)).toBeNull();
  });

  it("never rewrites a language-shaped prefix even when unsupported", () => {
    expect(decideLocaleRedirect("/fr", "en", null)).toBeNull();
    expect(decideLocaleRedirect("/en-US", "en", null)).toBeNull();
    expect(decideLocaleRedirect("/zh-Hant", "en", null)).toBeNull();
    expect(decideLocaleRedirect("/zh-Hant-TW", "en", null)).toBeNull();
    expect(decideLocaleRedirect("/zh-cn", "en", null)).toBeNull();
  });

  it("redirects ordinary hyphenated page paths that are not language-shaped", () => {
    expect(decideLocaleRedirect("/my-page", "en", null)).toBe("en");
  });

  it("never rewrites API routes", () => {
    expect(decideLocaleRedirect("/api/health", "en", null)).toBeNull();
  });

  it("never rewrites whitelisted static file suffixes, case-insensitively", () => {
    expect(decideLocaleRedirect("/logo.svg", "en", null)).toBeNull();
    expect(decideLocaleRedirect("/scripts/app.js", "en", null)).toBeNull();
    expect(decideLocaleRedirect("/APP.JS", "en", null)).toBeNull();
  });

  it("still redirects dots outside the static whitelist", () => {
    expect(decideLocaleRedirect("/article.v2", "en", null)).toBe("en");
  });

  it("falls back to the default Locale when nothing is acceptable", () => {
    expect(decideLocaleRedirect("/", "fr-FR", null)).toBe("zh");
  });
});
