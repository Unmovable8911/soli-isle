import { isLocale, siteConfig, type Locale } from "@/config/site";

/** The Locale a page without params can know, or the site's default. */
export function requestLocale(value: string | null | undefined): Locale {
  return value !== null && value !== undefined && isLocale(value) ? value : siteConfig.defaultLocale;
}
