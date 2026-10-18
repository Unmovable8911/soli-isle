/**
 * The value a query param carries. A repeated param is a mangled URL rather
 * than an ambiguous one, so the first value is the one the reader meant.
 */
export function firstQueryValue(raw: string | string[] | undefined): string | undefined {
  return Array.isArray(raw) ? raw[0] : raw;
}

/**
 * The selected Category path, or null for Latest. An absent, empty, or unknown
 * path all mean Latest: Home never 404s or redirects on a query string it
 * cannot honour.
 */
export function resolveCategoryPath(
  paths: readonly string[],
  raw: string | string[] | undefined,
): string | null {
  // An absent, empty, or unknown path matches no entry, so all three mean
  // Latest without a branch of their own.
  return paths.find((candidate) => candidate === firstQueryValue(raw)) ?? null;
}
