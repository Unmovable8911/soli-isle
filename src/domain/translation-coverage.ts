import { siteConfig, type Locale } from "@/config/site";

/**
 * Locale Coverage and Content Fallback, derived from the version rows a work
 * actually has. Nothing here is stored: a work's set of Locales is its
 * translation rows, read as they are.
 *
 * `locale` is deliberately a plain string in the pure selection rule so the
 * "defaultLocale before any other version" ordering can be exercised on a site
 * configured with more than two Locales; `localeCoverage` reports real Locales.
 */
export interface LocaleVersion {
  locale: string;
}

export interface LocaleCoverage {
  locale: Locale;
  /** True when this Site Locale has a version of the work. */
  hasVersion: boolean;
}

export interface TranslationSelection<T extends LocaleVersion> {
  translation: T;
  /** True when the version shown is not the one the Reader asked for. */
  fellBack: boolean;
}

/** True when this Locale really has a version of the work. */
function hasVersionIn(translations: readonly LocaleVersion[], locale: Locale): boolean {
  return translations.some((translation) => translation.locale === locale);
}

/** Every Site Locale, in the configured order, with whether a version exists. */
export function localeCoverage(translations: readonly LocaleVersion[]): LocaleCoverage[] {
  return siteConfig.locales.map((locale) => ({
    locale,
    hasVersion: hasVersionIn(translations, locale),
  }));
}

/** Only the Locales with a real version — the ones a declaration may name. */
export function coveredLocales(translations: readonly LocaleVersion[]): Locale[] {
  return siteConfig.locales.filter((locale) => hasVersionIn(translations, locale));
}

/**
 * The version a Reader asking for `requested` gets: their own, else the work's
 * default Locale, else any version that exists. Null only for a work with no
 * version at all, which has nothing to show.
 */
export function selectTranslation<T extends LocaleVersion>(
  translations: readonly T[],
  requested: Locale | string,
  defaultLocale: Locale | string,
): TranslationSelection<T> | null {
  const own = translations.find((translation) => translation.locale === requested);
  if (own !== undefined) {
    return { translation: own, fellBack: false };
  }

  const preferred = translations.find((translation) => translation.locale === defaultLocale);
  const translation =
    preferred ??
    siteConfig.locales
      .map((locale) => translations.find((candidate) => candidate.locale === locale))
      .find((candidate) => candidate !== undefined) ??
    translations[0];
  if (translation === undefined) {
    return null;
  }

  return { translation, fellBack: translation.locale !== requested };
}
