/**
 * The console's six entries, and which one the Author is currently inside.
 *
 * The console keeps a horizontal top bar (ADR-0001 refused a rail here), so the
 * bar can only say "you are here" by marking one link. That is a fact about the
 * path, not about the layout: it is decided here, without React, so the rule can
 * be read and tested on its own.
 */

export const ADMIN_ENTRIES = [
  "dashboard",
  "articles",
  "posts",
  "categories",
  "tags",
  "assets",
] as const;

export type AdminEntry = (typeof ADMIN_ENTRIES)[number];

/** The dashboard is the console root; the rest are one segment under it. */
export const ADMIN_ENTRY_PATHS: Record<AdminEntry, string> = {
  dashboard: "/admin",
  articles: "/admin/articles",
  posts: "/admin/posts",
  categories: "/admin/categories",
  tags: "/admin/tags",
  assets: "/admin/assets",
};

/**
 * The entry whose path the given one extends, or null when it is none of them
 * (the sign-in page sits outside the console, and nothing may claim a page that
 * is not one of the six). Matching is by whole segment, so `/admin/articles-archive`
 * is not the Articles page, and the dashboard is the console root only — every
 * other page under `/admin` belongs to a named entry, which wins by being longer.
 */
export function adminEntryFor(pathname: string): AdminEntry | null {
  const trimmed = pathname.replace(/\/+$/, "");
  let found: AdminEntry | null = null;
  let longest = 0;
  for (const entry of ADMIN_ENTRIES) {
    const base = ADMIN_ENTRY_PATHS[entry];
    const matches =
      trimmed === base || (entry !== "dashboard" && trimmed.startsWith(`${base}/`));
    if (matches && base.length > longest) {
      found = entry;
      longest = base.length;
    }
  }
  return found;
}
