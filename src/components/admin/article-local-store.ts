const DATABASE_NAME = "soli-isle-editor";
const STORE_NAME = "article-drafts";
const DATABASE_VERSION = 1;

/** An edit that is not on the server yet. Its bytes live here, never only in memory. */
export interface PendingArticleEdit {
  articleId: string;
  locale: string;
  title: string;
  summary: string;
  bodyJson: string;
  /** The server version the edit was derived from; `0` means the base is unknown. */
  baseVersion: number;
  savedAt: string;
}

export interface ArticleDraftStore {
  save(draft: PendingArticleEdit): Promise<void>;
  load(articleId: string, locale: string): Promise<PendingArticleEdit | null>;
  clear(articleId: string, locale: string): Promise<void>;
}

function draftKey(articleId: string, locale: string): string {
  return `${articleId}:${locale}`;
}

function readString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === "string" ? value : null;
}

/**
 * A record written before optimistic concurrency existed still holds the
 * Author's bytes, so it is restored — but with an unknown base version, which
 * makes it a conflict rather than a save the server might regret.
 */
export function readDraftRecord(value: unknown): PendingArticleEdit | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const record = value as Record<string, unknown>;
  const articleId = readString(record, "articleId");
  const locale = readString(record, "locale");
  const title = readString(record, "title");
  const summary = readString(record, "summary");
  const bodyJson = readString(record, "bodyJson");
  const savedAt = readString(record, "savedAt");
  if (
    articleId === null ||
    locale === null ||
    title === null ||
    summary === null ||
    bodyJson === null ||
    savedAt === null
  ) {
    return null;
  }

  const baseVersion = record.baseVersion;
  return {
    articleId,
    locale,
    title,
    summary,
    bodyJson,
    baseVersion:
      typeof baseVersion === "number" && Number.isInteger(baseVersion) && baseVersion >= 0
        ? baseVersion
        : 0,
    savedAt,
  };
}

export function createMemoryArticleDraftStore(): ArticleDraftStore {
  const records = new Map<string, PendingArticleEdit>();

  return {
    async save(draft) {
      records.set(draftKey(draft.articleId, draft.locale), { ...draft });
    },
    async load(articleId, locale) {
      return records.get(draftKey(articleId, locale)) ?? null;
    },
    async clear(articleId, locale) {
      records.delete(draftKey(articleId, locale));
    },
  };
}

function openDatabase(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
}

async function run<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest,
): Promise<T | null> {
  const database = await openDatabase();
  if (database === null) {
    return null;
  }

  return new Promise((resolve) => {
    const transaction = database.transaction(STORE_NAME, mode);
    const request = operation(transaction.objectStore(STORE_NAME));
    request.onsuccess = () => resolve(request.result as T);
    request.onerror = () => resolve(null);
    transaction.oncomplete = () => database.close();
  });
}

function createIndexedDbDraftStore(): ArticleDraftStore {
  return {
    async save(draft) {
      await run("readwrite", (store) =>
        store.put({ ...draft, key: draftKey(draft.articleId, draft.locale) }),
      );
    },
    async load(articleId, locale) {
      const record = await run<unknown>("readonly", (store) =>
        store.get(draftKey(articleId, locale)),
      );
      return readDraftRecord(record);
    },
    async clear(articleId, locale) {
      await run("readwrite", (store) => store.delete(draftKey(articleId, locale)));
    },
  };
}

let sharedStore: ArticleDraftStore | null = null;

/**
 * Durable while the browser allows it (IndexedDB), and a memory store when the
 * tab has none — the editor keeps working, it just cannot outlive the tab.
 *
 * Shared, because the memory fallback only holds bytes as long as the store
 * instance lives.
 */
export function getArticleDraftStore(): ArticleDraftStore {
  sharedStore ??=
    typeof indexedDB === "undefined"
      ? createMemoryArticleDraftStore()
      : createIndexedDbDraftStore();
  return sharedStore;
}
