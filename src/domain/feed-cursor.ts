import { isUlid } from "./ulid";

/**
 * The Feed's "load older" cursor: a base64url token over the (Publish Time,
 * Post id) pair of the last card the Reader already has.
 *
 * It is the Feed's only paging state — the URL never changes, so the token is
 * passed to the load-older endpoint as a query parameter and nothing else.
 * Decoding is strict: a token this module did not produce is rejected rather
 * than silently restarting the Feed at the top.
 */
export interface FeedCursor {
  /** The last visible card's Publish Time, exactly as stored. */
  publishTime: string;
  /** The same card's id; the tie-break for two Posts sharing a Publish Time. */
  id: string;
}

/** How many cards one page holds, and the most a Reader may ask for. */
export const FEED_PAGE_SIZE = 10;
export const FEED_PAGE_SIZE_MAX = 25;

const CURSOR_VERSION = "f1";

export function encodeFeedCursor(cursor: FeedCursor): string {
  const payload = [CURSOR_VERSION, cursor.publishTime, cursor.id].join("|");
  return Buffer.from(payload, "utf8").toString("base64url");
}

export function decodeFeedCursor(token: string): FeedCursor | null {
  const trimmed = token.trim();
  if (trimmed.length === 0 || !/^[A-Za-z0-9_-]+$/.test(trimmed)) {
    return null;
  }

  let payload: string;
  try {
    payload = Buffer.from(trimmed, "base64url").toString("utf8");
  } catch {
    return null;
  }

  const [version, publishTime, id, ...rest] = payload.split("|");
  if (version !== CURSOR_VERSION || rest.length > 0) {
    return null;
  }
  if (publishTime === undefined || id === undefined || !isUlid(id)) {
    return null;
  }
  if (Number.isNaN(Date.parse(publishTime))) {
    return null;
  }

  return { publishTime, id };
}

/** Clamps whatever arrived in `?limit=` to something a page may honestly render. */
export function normaliseFeedPageSize(value: string | number | null | undefined): number {
  if (value === null || value === undefined) {
    return FEED_PAGE_SIZE;
  }
  if (typeof value === "string" && value.trim().length === 0) {
    return FEED_PAGE_SIZE;
  }

  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    return FEED_PAGE_SIZE;
  }

  return Math.min(Math.max(Math.trunc(parsed), 1), FEED_PAGE_SIZE_MAX);
}

/**
 * The service fetches one row more than the page holds; that extra row is the
 * only honest answer to "is there anything older?".
 */
export function splitFeedPage<T>(
  rows: readonly T[],
  pageSize: number,
): { page: T[]; hasMore: boolean } {
  return { page: rows.slice(0, pageSize), hasMore: rows.length > pageSize };
}
