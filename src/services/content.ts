import { siteConfig, type Locale } from "@/config/site";

import { syncAssetReferences, type AssetContext } from "./assets";

/**
 * What an Article and a Post genuinely share.
 *
 * The spec asks for reuse "through shared domain types and shared service
 * functions"; the two works keep their own tables, but four things are the same
 * for both and were byte-identical copies before they landed here:
 *
 * - `groupBy` and `localeOrder`, the two shapes every record loader builds;
 * - the notion of an invalid body, which is the same validation failing;
 * - the result every write returns (`finishMutation`);
 * - the Asset-reference sync, which must read a body the same way for both or
 *   the Asset library will call one work's images orphans.
 *
 * Page-level order is `siteConfig.locales` order, so a work's versions are
 * always listed the same way on every surface, whatever the row order was.
 */
export function groupBy<T>(rows: readonly T[], key: (row: T) => string): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    const groupKey = key(row);
    const group = grouped.get(groupKey);
    if (group === undefined) {
      grouped.set(groupKey, [row]);
    } else {
      group.push(row);
    }
  }
  return grouped;
}

export function localeOrder(locale: Locale): number {
  const index = siteConfig.locales.indexOf(locale);
  return index === -1 ? siteConfig.locales.length : index;
}

/** The one validation failure behind both body errors; only its name differs. */
export class InvalidContentBodyError extends Error {
  constructor(name: string, message: string) {
    super(message);
    this.name = name;
  }
}

export class InvalidArticleBodyError extends InvalidContentBodyError {
  constructor() {
    super("InvalidArticleBodyError", "The article body must be a ProseMirror document");
  }
}

export class InvalidPostBodyError extends InvalidContentBodyError {
  constructor() {
    super("InvalidPostBodyError", "The post body must be a ProseMirror document");
  }
}

/**
 * How every write ends: reload the work and hand it back under the key its own
 * mutation type uses, or report the row that vanished between the two reads.
 */
export function finishMutation<TKey extends string, TRecord>(
  key: TKey,
  load: () => TRecord | null,
): ({ ok: true } & Record<TKey, TRecord>) | { ok: false; reason: "not-found" } {
  const record = load();
  if (record === null) {
    return { ok: false, reason: "not-found" };
  }
  return { ok: true, [key]: record } as { ok: true } & Record<TKey, TRecord>;
}

/**
 * Rewrites the Asset references a work owns from the bodies it stores. Both the
 * ProseMirror JSON and the derived Markdown are scanned — the JSON is the source
 * of truth, the Markdown is what search reads — plus whatever extra addresses
 * the work carries outside a body (a Post's attached images).
 */
export async function syncTranslationAssets(
  ctx: { assets: AssetContext },
  input: {
    contentKind: string;
    contentId: string;
    translations: readonly { bodyJson: string; bodyMarkdown: string }[];
    extra?: readonly string[];
  },
): Promise<void> {
  const body = [
    ...input.translations.map((row) => `${row.bodyJson}\n${row.bodyMarkdown}`),
    ...(input.extra ?? []),
  ].join("\n");

  await syncAssetReferences(ctx.assets, {
    contentKind: input.contentKind,
    contentId: input.contentId,
    body,
  });
}
