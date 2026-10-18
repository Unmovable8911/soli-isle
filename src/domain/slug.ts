const MAX_SLUG_LENGTH = 96;
const SLUG_PATTERN = /^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u;
const FALLBACK_SLUG = "article";

/**
 * Reduces arbitrary text to a URL-path-safe Slug. Unicode letters survive, so a
 * Chinese title still yields a Slug; everything else collapses to separators.
 */
export function normaliseSlug(value: string): string {
  const deaccented = value.normalize("NFKD").replace(/\p{M}/gu, "");

  const slug = deaccented
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/g, "");

  return slug;
}

export function isSafeSlug(value: string): boolean {
  return value.length > 0 && value.length <= MAX_SLUG_LENGTH && SLUG_PATTERN.test(value);
}

/** Appends a counter until the Slug is free, starting from `base` itself. */
export function uniqueSlug(base: string, isTaken: (candidate: string) => boolean): string {
  const root = base.length > 0 ? base : FALLBACK_SLUG;
  if (!isTaken(root)) {
    return root;
  }

  for (let counter = 2; counter < 1000; counter += 1) {
    const suffix = `-${counter}`;
    const trimmed = root.slice(0, MAX_SLUG_LENGTH - suffix.length).replace(/-+$/g, "");
    const candidate = `${trimmed}${suffix}`;
    if (!isTaken(candidate)) {
      return candidate;
    }
  }

  return `${root.slice(0, MAX_SLUG_LENGTH - 14)}-${Date.now().toString(32)}`;
}
