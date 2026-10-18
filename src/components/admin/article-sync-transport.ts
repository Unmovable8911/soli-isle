import type { ServerArticleState } from "@/domain/article-sync";

import type { ArticleSyncTransport, SaveOutcome } from "./article-sync-engine";

interface TranslationRecord {
  locale?: unknown;
  title?: unknown;
  summary?: unknown;
  bodyJson?: unknown;
  version?: unknown;
}

/** Accepts a translation record only when it holds everything a base version needs. */
function toServerState(value: unknown, locale: string): ServerArticleState | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const record = value as TranslationRecord;
  const { title, summary, bodyJson, version } = record;
  if (
    record.locale !== locale ||
    typeof title !== "string" ||
    typeof summary !== "string" ||
    typeof bodyJson !== "string" ||
    typeof version !== "number" ||
    !Number.isInteger(version) ||
    version < 1
  ) {
    return null;
  }
  return { version, title, summary, bodyJson };
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function translationFromArticle(payload: unknown, locale: string): ServerArticleState | null {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }
  const article = (payload as { article?: unknown }).article;
  if (typeof article !== "object" || article === null) {
    return null;
  }
  const translations = (article as { translations?: unknown }).translations;
  if (!Array.isArray(translations)) {
    return null;
  }
  const match = translations.find(
    (candidate: TranslationRecord) => candidate?.locale === locale,
  );
  return toServerState(match, locale);
}

function staleFromPayload(payload: unknown, locale: string): ServerArticleState | null {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }
  const record = payload as { error?: unknown; current?: unknown };
  if (record.error !== "stale-content") {
    return null;
  }
  return toServerState(record.current, locale);
}

export interface ArticleSyncTransportOptions {
  articleId: string;
  locale: string;
  /** Test seam only; production uses the platform `fetch`. */
  fetchImpl?: typeof fetch;
}

/**
 * Turns the translation endpoint into the three outcomes the sync engine acts
 * on. Anything unexpected is `unavailable`: an unanswered save keeps the local
 * copy queued instead of pretending it landed.
 */
export function createArticleSyncTransport(
  options: ArticleSyncTransportOptions,
): ArticleSyncTransport {
  const fetchImpl = options.fetchImpl ?? fetch;

  return {
    async save(draft): Promise<SaveOutcome> {
      let response: Response;
      try {
        response = await fetchImpl(
          `/api/admin/articles/${options.articleId}/translations/${options.locale}`,
          {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              baseVersion: draft.baseVersion,
              title: draft.title,
              summary: draft.summary,
              bodyJson: draft.bodyJson,
            }),
          },
        );
      } catch {
        return { kind: "unavailable" };
      }

      const payload = await readJson(response);
      if (response.status === 409) {
        const current = staleFromPayload(payload, options.locale);
        return current === null ? { kind: "unavailable" } : { kind: "stale", current };
      }
      if (!response.ok) {
        return { kind: "unavailable" };
      }
      const translation = translationFromArticle(payload, options.locale);
      return translation === null ? { kind: "unavailable" } : { kind: "saved", translation };
    },
  };
}
