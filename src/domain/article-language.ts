/**
 * Which **Locale versions** of a work exist, and what a page must declare about
 * them: the canonical URL of the version it shows, the `hreflang` alternates for
 * the Locales that really have one, and the versions a switcher may offer.
 *
 * This is Locale coverage, not machine translation. Nothing here translates
 * anything: the `hreflang` / `alternates.languages` names are the platform's
 * vocabulary for "a version in this Locale exists", and the Chinese prose names
 * live only in the `reader.languages` message namespace.
 */
import type { Locale } from "@/config/site";
import { buildArticlePath } from "./article-url";
import { localeCoverage, type LocaleVersion } from "./translation-coverage";
import { requestUrl, type HeaderSource } from "./urls";

/** One Locale's version of a work, as a switcher link. A Locale coverage fact. */
export interface LanguageVersionLink {
  locale: Locale;
  /** Absolute whenever the request carried a usable Host; a path otherwise. */
  href: string;
  /** True when this Locale really has a version of the work. */
  hasVersion: boolean;
}

export interface LanguageAlternate {
  locale: Locale;
  href: string;
}

export interface ArticleLanguageLinks {
  /**
   * The URL of the version this page shows: the Reader's own when it exists,
   * the fallback version otherwise. A Content Fallback page is not a
   * translation of its own, so it declares the version it displays.
   */
  canonical: string;
  /** Every Site Locale with its Locale Coverage, for the work's switcher. */
  versions: LanguageVersionLink[];
  /** Only the Locales with a real version: what the head may declare. */
  alternates: LanguageAlternate[];
}

/**
 * The language declarations of one Article page, derived from the versions it
 * really has and from the request's own origin — never from a configured
 * domain, and never from a stored list of covered Locales.
 */
export function articleLanguageLinks(input: {
  slug: string;
  /** The version the page renders, as the reading service decided it. */
  shownLocale: Locale;
  translations: readonly LocaleVersion[];
  headers: HeaderSource;
}): ArticleLanguageLinks {
  const hrefFor = (locale: Locale): string =>
    requestUrl(buildArticlePath({ locale, slug: input.slug }), input.headers);

  const versions = localeCoverage(input.translations).map(({ locale, hasVersion }) => ({
    locale,
    href: hrefFor(locale),
    hasVersion,
  }));

  return {
    canonical: hrefFor(input.shownLocale),
    versions,
    alternates: versions
      .filter((version) => version.hasVersion)
      .map((version) => ({ locale: version.locale, href: version.href })),
  };
}

/**
 * The `alternates.languages` map a page hands to Next: `hreflang` → URL, for the
 * Locales with a real version only.
 */
export function alternateLanguageMap(links: ArticleLanguageLinks): Record<string, string> {
  return Object.fromEntries(
    links.alternates.map((alternate) => [alternate.locale, alternate.href]),
  );
}
