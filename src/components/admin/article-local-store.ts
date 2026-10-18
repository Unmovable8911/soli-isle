const DATABASE_NAME = "soli-isle-editor";
const STORE_NAME = "article-drafts";
const DATABASE_VERSION = 1;

export interface LocalArticleDraft {
  key: string;
  articleId: string;
  locale: string;
  title: string;
  summary: string;
  bodyJson: string;
  savedAt: string;
}

function draftKey(articleId: string, locale: string): string {
  return `${articleId}:${locale}`;
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

/** The local copy is written before every server sync, never after. */
export async function saveLocalDraft(draft: Omit<LocalArticleDraft, "key">): Promise<void> {
  await run("readwrite", (store) =>
    store.put({ ...draft, key: draftKey(draft.articleId, draft.locale) }),
  );
}

export async function loadLocalDraft(
  articleId: string,
  locale: string,
): Promise<LocalArticleDraft | null> {
  return run<LocalArticleDraft>("readonly", (store) => store.get(draftKey(articleId, locale)));
}

export async function clearLocalDraft(articleId: string, locale: string): Promise<void> {
  await run("readwrite", (store) => store.delete(draftKey(articleId, locale)));
}
