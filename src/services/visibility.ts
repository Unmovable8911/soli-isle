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
