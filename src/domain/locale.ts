import { isLocale, siteConfig, type Locale } from "@/config/site";

export interface AcceptLanguageEntry {
  tag: string;
  q: number;
}

const Q_PARAMETER = /^q=(.*)$/i;

export function parseAcceptLanguage(header: string | null): AcceptLanguageEntry[] {
  if (!header) {
    return [];
  }

  const entries: AcceptLanguageEntry[] = [];
  for (const item of header.split(",")) {
    const [tag = "", ...parameters] = item.split(";");
    const trimmedTag = tag.trim();
    if (!trimmedTag) {
      continue;
    }

    let q = 1;
    let acceptable = true;
    for (const parameter of parameters) {
      const match = Q_PARAMETER.exec(parameter.trim());
      if (!match) {
        continue;
      }

      const raw = (match[1] ?? "").trim();
      const value = Number(raw);
      if (raw === "" || !Number.isFinite(value) || value <= 0 || value > 1) {
        acceptable = false;
        break;
      }
      q = value;
      break;
    }

    if (acceptable) {
      entries.push({ tag: trimmedTag, q });
    }
  }

  return entries.sort((a, b) => b.q - a.q);
}

export function negotiateLocale(
  acceptLanguage: string | null,
  preferredLocale: string | null,
): Locale {
  if (preferredLocale !== null && isLocale(preferredLocale)) {
    return preferredLocale;
  }

  for (const { tag } of parseAcceptLanguage(acceptLanguage)) {
    if (tag === "*") {
      return siteConfig.defaultLocale;
    }

    const primary = tag.split("-")[0]?.toLowerCase() ?? "";
    if (primary && isLocale(primary)) {
      return primary;
    }
  }

  return siteConfig.defaultLocale;
}

const PRIMARY_LANGUAGE_TAG = /^[A-Za-z]{2,3}$/;
const SUPPORTED_LOCALE_PREFIX = new RegExp(`^(?:${siteConfig.locales.join("|")})-(?!$)`, "i");

export function isLanguageTagLike(segment: string): boolean {
  return PRIMARY_LANGUAGE_TAG.test(segment) || SUPPORTED_LOCALE_PREFIX.test(segment);
}

export function localeFromPathname(pathname: string): Locale | null {
  const firstSegment = pathname.split("/")[1] ?? "";
  return isLocale(firstSegment) ? firstSegment : null;
}

export function swapLocalePathname(pathname: string, target: Locale): string {
  const locale = localeFromPathname(pathname);
  if (locale === null) {
    return `/${target}${pathname}`;
  }

  return `/${target}${pathname.slice(locale.length + 1)}`;
}

export function withLocalePrefix(pathname: string, locale: Locale): string {
  return `/${locale}${pathname === "/" ? "" : pathname}`;
}

const STATIC_FILE_SUFFIX =
  /\.(?:ico|png|jpe?g|gif|svg|webp|avif|css|js|mjs|map|txt|xml|json|webmanifest|woff2?|ttf|eot|mp4|webm|pdf|zip)$/i;

export function decideLocaleRedirect(
  pathname: string,
  acceptLanguage: string | null,
  preferredLocale: string | null,
): Locale | null {
  if (STATIC_FILE_SUFFIX.test(pathname)) {
    return null;
  }
  if (pathname.startsWith("/api/")) {
    return null;
  }

  const firstSegment = pathname.split("/")[1] ?? "";
  if (isLanguageTagLike(firstSegment)) {
    return null;
  }

  return negotiateLocale(acceptLanguage, preferredLocale);
}
