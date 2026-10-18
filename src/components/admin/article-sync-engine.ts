import {
  reconcileArticleEdit,
  type ArticleEditContent,
  type ServerArticleState,
} from "@/domain/article-sync";
import type { Clock } from "@/domain/clock";

import type { ArticleDraftStore, PendingArticleEdit } from "./article-local-store";

export type SyncStatus = "idle" | "local" | "syncing" | "saved" | "offline" | "conflict";

export type SaveOutcome =
  | { kind: "saved"; translation: ServerArticleState }
  /** The server refused the write and handed back the copy it holds instead. */
  | { kind: "stale"; current: ServerArticleState }
  /** The request never reached the server; the local copy stays pending. */
  | { kind: "unavailable" };

export interface ArticleSyncTransport {
  save(draft: PendingArticleEdit): Promise<SaveOutcome>;
}

export type SyncStart = { kind: "clean" } | { kind: "recovered"; draft: PendingArticleEdit };

export interface ArticleSyncEngine {
  /** Seeds the server copy and restores any unsynced edit left by a previous visit. */
  start(server: ServerArticleState): Promise<SyncStart>;
  edit(content: ArticleEditContent): Promise<void>;
  /** Attempts a sync now, whatever the throttle says. */
  flushNow(): Promise<void>;
  /** Points the engine at a server copy it now knows is current. */
  adoptServer(server: ServerArticleState): void;
  /** The Author chose the server copy; their local bytes are dropped on purpose. */
  discardLocal(): Promise<void>;
  setOnline(online: boolean): void;
  status(): SyncStatus;
  subscribe(listener: (status: SyncStatus) => void): () => void;
  dispose(): void;
}

export interface ArticleSyncOptions {
  articleId: string;
  locale: string;
  store: ArticleDraftStore;
  transport: ArticleSyncTransport;
  clock: Clock;
  /** Schedules a callback and returns its cancel function. */
  schedule: SyncScheduler;
  throttleMs: number;
  retryBaseMs: number;
  retryMaxMs: number;
  /** Called once per acknowledged save; the editor uses it for revision snapshots. */
  onSaved?: (translation: ServerArticleState) => void;
}

export type SyncScheduler = (callback: () => unknown, delayMs: number) => () => void;

/** The browser scheduler the editor uses; tests inject a controllable one. */
export function createTimeoutSchedule(): SyncScheduler {
  return (callback, delayMs) => {
    const handle = setTimeout(() => {
      void callback();
    }, delayMs);
    return () => clearTimeout(handle);
  };
}

export function createArticleSyncEngine(options: ArticleSyncOptions): ArticleSyncEngine {
  const { articleId, locale, store, transport, clock, schedule } = options;
  const listeners = new Set<(status: SyncStatus) => void>();

  let server: ServerArticleState | null = null;
  let pending: PendingArticleEdit | null = null;
  let status: SyncStatus = "idle";
  let online = true;
  let failureCount = 0;
  let inFlight = false;
  let disposed = false;
  let cancelScheduled: (() => void) | null = null;
  let writeChain: Promise<void> = Promise.resolve();

  function setStatus(next: SyncStatus): void {
    if (disposed || status === next) {
      return;
    }
    status = next;
    for (const listener of listeners) {
      listener(next);
    }
  }

  function queueWrite(operation: () => Promise<void>): Promise<void> {
    writeChain = writeChain.then(operation, operation);
    return writeChain;
  }

  function cancelTimer(): void {
    if (cancelScheduled !== null) {
      cancelScheduled();
      cancelScheduled = null;
    }
  }

  function scheduleFlush(delayMs: number): void {
    cancelTimer();
    cancelScheduled = schedule(() => {
      cancelScheduled = null;
      return flushNow();
    }, delayMs);
  }

  function scheduleRetry(): void {
    const delay = Math.min(options.retryBaseMs * 2 ** Math.max(0, failureCount - 1), options.retryMaxMs);
    scheduleFlush(delay);
  }

  async function clearPending(): Promise<void> {
    pending = null;
    await queueWrite(() => store.clear(articleId, locale));
  }

  async function flushNow(): Promise<void> {
    cancelTimer();
    if (disposed || inFlight || server === null || pending === null) {
      return;
    }
    if (!online) {
      setStatus("offline");
      return;
    }

    const decision = reconcileArticleEdit(pending, server);
    if (decision === "in-sync") {
      await clearPending();
      setStatus("saved");
      return;
    }
    if (decision === "conflict") {
      // No write, ever: the Author decides what happens to their bytes.
      setStatus("conflict");
      return;
    }

    const sent = pending;
    inFlight = true;
    setStatus("syncing");
    try {
      const outcome = await transport.save(sent);
      if (outcome.kind === "unavailable") {
        failureCount += 1;
        setStatus("offline");
        scheduleRetry();
        return;
      }
      if (outcome.kind === "stale") {
        server = outcome.current;
        setStatus("conflict");
        return;
      }

      server = outcome.translation;
      failureCount = 0;
      options.onSaved?.(outcome.translation);
      await rebindPending(outcome.translation);
    } finally {
      inFlight = false;
    }
  }

  /**
   * After an acknowledgement the queued edit — possibly one the Author typed
   * while the request was in flight — inherits the new base version, and the
   * reconciliation decides whether there is still anything to send.
   */
  async function rebindPending(saved: ServerArticleState): Promise<void> {
    if (pending === null) {
      setStatus("saved");
      return;
    }
    pending = { ...pending, baseVersion: saved.version };
    const decision = reconcileArticleEdit(pending, saved);
    if (decision === "in-sync") {
      await clearPending();
      setStatus("saved");
      return;
    }
    const rebound = pending;
    await queueWrite(() => store.save(rebound));
    setStatus("local");
    scheduleFlush(0);
  }

  return {
    async start(nextServer) {
      server = nextServer;
      failureCount = 0;
      pending = await store.load(articleId, locale);
      if (pending === null) {
        setStatus("idle");
        return { kind: "clean" };
      }

      const draft = pending;
      const decision = reconcileArticleEdit(draft, nextServer);
      if (decision === "in-sync") {
        await clearPending();
        setStatus("saved");
        return { kind: "clean" };
      }
      if (decision === "conflict") {
        setStatus("conflict");
        return { kind: "recovered", draft };
      }

      setStatus("local");
      scheduleFlush(0);
      return { kind: "recovered", draft };
    },

    async edit(content) {
      if (disposed) {
        return;
      }
      pending = {
        articleId,
        locale,
        title: content.title,
        summary: content.summary,
        bodyJson: content.bodyJson,
        baseVersion: server?.version ?? 0,
        savedAt: clock.now().toISOString(),
      };
      const draft = pending;
      await queueWrite(() => store.save(draft));
      setStatus("local");
      if (!inFlight) {
        scheduleFlush(options.throttleMs);
      }
    },

    flushNow,

    adoptServer(nextServer) {
      server = nextServer;
    },

    async discardLocal() {
      cancelTimer();
      failureCount = 0;
      await clearPending();
      setStatus(server === null ? "idle" : "saved");
    },

    setOnline(nextOnline) {
      if (disposed || online === nextOnline) {
        return;
      }
      online = nextOnline;
      if (!online) {
        cancelTimer();
        if (pending !== null) {
          setStatus("offline");
        }
        return;
      }
      failureCount = 0;
      if (pending !== null) {
        scheduleFlush(0);
      }
    },

    status: () => status,

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    dispose() {
      disposed = true;
      cancelTimer();
      listeners.clear();
    },
  };
}
