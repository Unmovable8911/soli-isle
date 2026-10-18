import { and, eq, isNull, lte, or, sql, type SQL } from "drizzle-orm";
import type { AnySQLiteColumn } from "drizzle-orm/sqlite-core";

/**
 * The one "a Reader may see this right now" predicate.
 *
 * Articles and Posts keep separate tables — the spec forbids a shared parent
 * table — but they must agree on what visible means, so the predicate is
 * written once over the two columns both tables carry and applied to whichever
 * table asks. Every Reader-facing read (the Article lists, search, the Feed)
 * goes through here.
 */
export function visibleToReader(
  publicationState: AnySQLiteColumn,
  publishTime: AnySQLiteColumn,
  nowIso: string,
): SQL {
  return (
    and(
      eq(publicationState, "published"),
      or(isNull(publishTime), lte(publishTime, nowIso)),
    ) ?? sql`0 = 1`
  );
}

/**
 * The one "a Reader may open this by URL right now" predicate, the SQL twin of
 * `isReadableByUrl` in `@/domain/publication`: visible now, **and** archived.
 * An archived Article leaves the lists but keeps answering on its own URL, so
 * it still belongs to that URL's previous/next chain. Only the chain uses this;
 * every list keeps to `visibleToReader`.
 */
export function readableByUrl(
  publicationState: AnySQLiteColumn,
  publishTime: AnySQLiteColumn,
  nowIso: string,
): SQL {
  return (
    or(visibleToReader(publicationState, publishTime, nowIso), eq(publicationState, "archived")) ??
    sql`0 = 1`
  );
}
