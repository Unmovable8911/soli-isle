import { isLocale, type Locale } from "@/config/site";

/**
 * The Reader-facing URL map, next to `article-url.ts` (ticket 05), which owns
 * `/{locale}/articles/{slug}`. Nothing here replaces that shape.
 */
export function buildHomePath(locale: Locale): string {
  return `/${locale}`;
}

export function buildCategoryIndexPath(locale: Locale): string {
  return `/${locale}/categories`;
}

export function buildCategoryPath(input: { locale: Locale; categoryPath: string }): string {
  const segments = input.categoryPath
    .split("/")
    .filter((segment) => segment.length > 0)
    .map((segment) => encodeURIComponent(segment));

  if (segments.length === 0) {
    return buildCategoryIndexPath(input.locale);
  }
  return `${buildCategoryIndexPath(input.locale)}/${segments.join("/")}`;
}

export function buildTagPath(input: { locale: Locale; slug: string }): string {
  return `/${input.locale}/tags/${encodeURIComponent(input.slug)}`;
}

export function buildArchivePath(locale: Locale): string {
  return `/${locale}/archive`;
}

export function buildSearchPath(input: { locale: Locale; query?: string }): string {
  const base = `/${input.locale}/search`;
  const query = input.query?.trim() ?? "";
  if (query.length === 0) {
    return base;
  }
  return `${base}?${new URLSearchParams({ q: query }).toString()}`;
}

/** The Sitemap is site-wide, not per Locale, and its `.xml` suffix keeps it out of the locale redirect. */
export const SITEMAP_PATH = "/sitemap.xml";

const CATEGORY_PATH = /^\/([^/]+)\/categories(?:\/(.*))?$/;
const TAG_PATH = /^\/([^/]+)\/tags\/([^/]+)\/?$/;

function decodeSegment(segment: string): string | null {
  try {
    const decoded = decodeURIComponent(segment);
    return decoded.length === 0 || decoded.includes("/") ? null : decoded;
  } catch {
    return null;
  }
}

function decodeSegments(path: string): string | null {
  const decoded: string[] = [];
  for (const segment of path.split("/")) {
    if (segment.length === 0) {
      continue;
    }
    const value = decodeSegment(segment);
    if (value === null) {
      return null;
    }
    decoded.push(value);
  }
  return decoded.join("/");
}

export function parseCategoryPath(
  pathname: string,
): { locale: Locale; categoryPath: string } | null {
  const match = CATEGORY_PATH.exec(pathname);
  if (match === null) {
    return null;
  }
  const [, locale, rest] = match;
  if (locale === undefined || !isLocale(locale)) {
    return null;
  }
  if (rest === undefined) {
    return { locale, categoryPath: "" };
  }
  const categoryPath = decodeSegments(rest);
  if (categoryPath === null) {
    return null;
  }
  return { locale, categoryPath };
}

export function parseTagPath(pathname: string): { locale: Locale; slug: string } | null {
  const match = TAG_PATH.exec(pathname);
  if (match === null) {
    return null;
  }
  const [, locale, encodedSlug] = match;
  if (locale === undefined || encodedSlug === undefined || !isLocale(locale)) {
    return null;
  }
  const slug = decodeSegment(encodedSlug);
  if (slug === null) {
    return null;
  }
  return { locale, slug };
}
