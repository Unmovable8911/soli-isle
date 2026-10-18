import { isLocale, siteConfig, type Locale } from "@/config/site";

export type LocalisedNames = Partial<Record<Locale, string>>;

/**
 * The one display rule shared by categories, tags and Article translations:
 * prefer the requested Locale, then the site default Locale, then anything.
 */
export function pickLocalised(
  names: Partial<Record<string, string>>,
  locale: Locale,
  fallback: string,
): string {
  const preferred = names[locale];
  if (preferred !== undefined && preferred.length > 0) {
    return preferred;
  }

  const candidates = [
    siteConfig.defaultLocale,
    ...siteConfig.locales.filter((candidate) => candidate !== siteConfig.defaultLocale),
  ];
  for (const candidate of candidates) {
    if (!isLocale(candidate)) {
      continue;
    }
    const name = names[candidate];
    if (name !== undefined && name.length > 0) {
      return name;
    }
  }

  return fallback;
}
