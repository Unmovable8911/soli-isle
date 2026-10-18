import { describe, expect, it } from "vitest";

import { alternateLanguageMap, articleLanguageLinks } from "./article-language";

const headers = new Headers({
  host: "isle.example",
  "x-forwarded-proto": "https",
});

describe("article language links", () => {
  it("declares a single version, canonically its own URL, from the request origin", () => {
    const links = articleLanguageLinks({
      slug: "hello-world",
      shownLocale: "zh",
      translations: [{ locale: "zh" }],
      headers,
    });

    expect(links.canonical).toBe("https://isle.example/zh/articles/hello-world");
    expect(links.alternates).toEqual([
      { locale: "zh", href: "https://isle.example/zh/articles/hello-world" },
    ]);
  });

  it("declares both versions of a two-version work, in the configured Locale order", () => {
    const links = articleLanguageLinks({
      slug: "hello-world",
      shownLocale: "zh",
      translations: [{ locale: "en" }, { locale: "zh" }],
      headers,
    });

    expect(links.alternates).toEqual([
      { locale: "zh", href: "https://isle.example/zh/articles/hello-world" },
      { locale: "en", href: "https://isle.example/en/articles/hello-world" },
    ]);
    expect(links.canonical).toBe("https://isle.example/zh/articles/hello-world");
  });

  it("points a Content Fallback page's canonical at the version it really shows", () => {
    const links = articleLanguageLinks({
      slug: "hello-world",
      shownLocale: "zh",
      translations: [{ locale: "zh" }],
      headers,
    });

    expect(links.canonical).toBe("https://isle.example/zh/articles/hello-world");
    // The `en` URL is not a version, so it is never declared — the page that
    // answers it is the `zh` version with a notice.
    expect(links.alternates.map((alternate) => alternate.locale)).toEqual(["zh"]);
  });

  it("offers every Site Locale to the switcher, marking the ones without a version", () => {
    const links = articleLanguageLinks({
      slug: "hello-world",
      shownLocale: "zh",
      translations: [{ locale: "zh" }],
      headers,
    });

    expect(links.versions).toEqual([
      {
        locale: "zh",
        href: "https://isle.example/zh/articles/hello-world",
        hasVersion: true,
      },
      {
        locale: "en",
        href: "https://isle.example/en/articles/hello-world",
        hasVersion: false,
      },
    ]);
  });

  it("maps the declarations to the hreflang keys Next expects, real versions only", () => {
    const links = articleLanguageLinks({
      slug: "hello-world",
      shownLocale: "zh",
      translations: [{ locale: "zh" }],
      headers,
    });

    expect(alternateLanguageMap(links)).toEqual({
      zh: "https://isle.example/zh/articles/hello-world",
    });
  });

  it("falls back to the requested path shape when the request carries no usable Host", () => {
    const links = articleLanguageLinks({
      slug: "hello world",
      shownLocale: "zh",
      translations: [{ locale: "zh" }],
      headers: new Headers(),
    });

    expect(links.canonical).toBe("/zh/articles/hello%20world");
    expect(links.versions[0]?.href).toBe("/zh/articles/hello%20world");
  });
});
