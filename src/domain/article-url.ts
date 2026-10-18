import { isLocale, type Locale } from "@/config/site";

const ARTICLE_PATH = /^\/([^/]+)\/articles\/([^/]+)\/?$/;

export function buildArticlePath(input: { locale: Locale; slug: string }): string {
  return `/${input.locale}/articles/${encodeURIComponent(input.slug)}`;
}

export function parseArticlePath(
  pathname: string,
): { locale: Locale; slug: string } | null {
  const match = ARTICLE_PATH.exec(pathname);
  if (match === null) {
    return null;
  }

  const [, locale, encodedSlug] = match;
  if (locale === undefined || encodedSlug === undefined || !isLocale(locale)) {
    return null;
  }

  let slug: string;
  try {
    slug = decodeURIComponent(encodedSlug);
  } catch {
    return null;
  }

  if (slug.length === 0 || slug.includes("/")) {
    return null;
  }

  return { locale, slug };
}
