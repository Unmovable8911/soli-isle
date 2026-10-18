import { describe, expect, it } from "vitest";

import type { Locale } from "@/config/site";
import { coveredLocales, localeCoverage, selectTranslation } from "./translation-coverage";

interface Version {
  locale: string;
  title: string;
}

function version(locale: string): Version {
  return { locale, title: `${locale} title` };
}

describe("locale coverage", () => {
  it("reports every Site Locale, in the configured order, with whether a version exists", () => {
    expect(localeCoverage([version("en")])).toEqual([
      { locale: "zh", hasVersion: false },
      { locale: "en", hasVersion: true },
    ]);
  });

  it("reports full coverage for a work that has every version", () => {
    expect(localeCoverage([version("en"), version("zh")])).toEqual([
      { locale: "zh", hasVersion: true },
      { locale: "en", hasVersion: true },
    ]);
  });

  it("is derived from the rows it is handed, so a work with no version covers nothing", () => {
    expect(localeCoverage([])).toEqual([
      { locale: "zh", hasVersion: false },
      { locale: "en", hasVersion: false },
    ]);
  });

  it("names only the Locales with a real version, in the configured order", () => {
    expect(coveredLocales([version("en"), version("zh")])).toEqual(["zh", "en"]);
    expect(coveredLocales([version("en")])).toEqual(["en"]);
    expect(coveredLocales([])).toEqual([]);
  });
});

describe("fallback selection", () => {
  it("shows the version the Reader asked for, and that is not a fallback", () => {
    const translations = [version("zh"), version("en")];

    expect(selectTranslation(translations, "en", "zh")).toEqual({
      translation: version("en"),
      fellBack: false,
    });
  });

  it("shows the work's default Locale when the requested Locale has no version", () => {
    expect(selectTranslation([version("zh")], "en", "zh")).toEqual({
      translation: version("zh"),
      fellBack: true,
    });
  });

  it("consults the work's defaultLocale before any other version", () => {
    // Three Locales so the rule is observable: the Reader asks for `ja`, the
    // work has `zh` and `en`, and its default is `en` — `en` is shown.
    const translations = [version("zh"), version("en")];

    expect(selectTranslation(translations, "ja", "en")).toEqual({
      translation: version("en"),
      fellBack: true,
    });
    expect(selectTranslation(translations, "ja", "zh")).toEqual({
      translation: version("zh"),
      fellBack: true,
    });
  });

  it("still answers when the default version is gone, taking whatever exists", () => {
    expect(selectTranslation([version("en")], "zh", "zh")).toEqual({
      translation: version("en"),
      fellBack: true,
    });
  });

  it("has nothing to show for a work with no version at all", () => {
    expect(selectTranslation([], "zh", "zh")).toBeNull();
  });
});

describe("the coverage the Reader is offered", () => {
  it("never claims a Locale the work does not have", () => {
    const coverage: { locale: Locale; hasVersion: boolean }[] = localeCoverage([version("zh")]);

    expect(coverage.filter((entry) => entry.hasVersion).map((entry) => entry.locale)).toEqual([
      "zh",
    ]);
  });
});
