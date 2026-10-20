import { firstQueryValue } from "./home-listing";

export interface PageSlice<T> {
  /** The entries on the page actually shown. */
  items: T[];
  /** The page actually shown, clamped into 1..pageCount. */
  page: number;
  /** Never below 1: an empty listing still has page 1. */
  pageCount: number;
}

/**
 * A page lives in a URL anyone can edit, so every shape that is not a positive
 * integer (repeated, empty, zero, negative, fractional, exponent) means the
 * first page rather than an error the reader did not cause.
 */
export function parsePageNumber(raw: string | string[] | undefined): number {
  const first = firstQueryValue(raw);
  if (first === undefined) {
    return 1;
  }
  const trimmed = first.trim();
  if (!/^\d+$/.test(trimmed)) {
    return 1;
  }
  const page = Number(trimmed);
  return page >= 1 ? page : 1;
}

export function pageCountOf(total: number, size: number): number {
  if (total <= 0 || size <= 0) {
    return 1;
  }
  return Math.max(1, Math.ceil(total / size));
}

export function paginate<T>(items: readonly T[], page: number, size: number): PageSlice<T> {
  if (size <= 0) {
    return { items: [], page: 1, pageCount: 1 };
  }
  const pageCount = pageCountOf(items.length, size);
  const requested = Number.isFinite(page) ? Math.trunc(page) : 1;
  const shown = Math.min(Math.max(requested, 1), pageCount);
  const start = (shown - 1) * size;
  return { items: items.slice(start, start + size), page: shown, pageCount };
}
