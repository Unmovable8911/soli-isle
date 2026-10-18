import { describe, expect, it } from "vitest";

import type { ArticleEditContent, ServerArticleState } from "@/domain/article-sync";
import { createMemoryArticleDraftStore, type PendingArticleEdit } from "./article-local-store";
import {
  createArticleSyncEngine,
  type ArticleSyncEngine,
  type SaveOutcome,
  type SyncStatus,
} from "./article-sync-engine";

const DOC = '{"type":"doc","content":[{"type":"paragraph"}]}';
const EDITED = '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"hi"}]}]}';
const SERVER: ServerArticleState = { version: 1, title: "Base", summary: "", bodyJson: DOC };
const CONTENT: ArticleEditContent = { title: "Mine", summary: "", bodyJson: EDITED };

interface Deferred<T> {
  promise: Promise<T>;
  resolve(value: T): void;
}

function deferred<T>(): Deferred<T> {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

interface ManualClock {
  now(): Date;
  advance(ms: number): void;
}

function manualClock(startIso: string): ManualClock {
  let current = new Date(startIso);
  return {
    now: () => new Date(current),
    advance(ms: number) {
      current = new Date(current.getTime() + ms);
    },
  };
}

interface SchedulerDouble {
  schedule(callback: () => unknown, delayMs: number): () => void;
  delays(): number[];
  /** Runs every callback scheduled so far, in order. */
  run(): Promise<void>;
}

function createScheduler(): SchedulerDouble {
  let queue: Array<{ callback: () => unknown; delayMs: number }> = [];
  return {
    schedule(callback, delayMs) {
      const entry = { callback, delayMs };
      queue.push(entry);
      return () => {
        queue = queue.filter((candidate) => candidate !== entry);
      };
    },
    delays: () => queue.map((entry) => entry.delayMs),
    async run() {
      const entries = queue;
      queue = [];
      for (const entry of entries) {
        await entry.callback();
      }
    },
  };
}

interface TransportDouble {
  save(draft: PendingArticleEdit): Promise<SaveOutcome>;
  calls: PendingArticleEdit[];
  reply(outcome: SaveOutcome): void;
  hold(): Deferred<SaveOutcome>;
}

function createTransport(): TransportDouble {
  const calls: PendingArticleEdit[] = [];
  const replies: SaveOutcome[] = [];
  let held: Deferred<SaveOutcome> | null = null;
  return {
    calls,
    reply(outcome) {
      replies.push(outcome);
    },
    hold() {
      held = deferred<SaveOutcome>();
      return held;
    },
    async save(draft) {
      calls.push(draft);
      if (held !== null) {
        const current = held;
        held = null;
        return current.promise;
      }
      const outcome = replies.shift();
      if (outcome === undefined) {
        throw new Error("The engine saved without a scripted outcome");
      }
      return outcome;
    },
  };
}

interface Fixture {
  engine: ArticleSyncEngine;
  store: ReturnType<typeof createMemoryArticleDraftStore>;
  transport: TransportDouble;
  scheduler: SchedulerDouble;
  clock: ManualClock;
  statuses: SyncStatus[];
}

function createFixture(): Fixture {
  const store = createMemoryArticleDraftStore();
  const transport = createTransport();
  const scheduler = createScheduler();
  const clock = manualClock("2025-06-15T08:30:00.000Z");
  const engine = createArticleSyncEngine({
    articleId: "01J8ZZ",
    locale: "zh",
    store,
    transport,
    clock,
    schedule: scheduler.schedule,
    throttleMs: 2000,
    retryBaseMs: 1000,
    retryMaxMs: 4000,
  });
  const statuses: SyncStatus[] = [];
  engine.subscribe((status) => statuses.push(status));
  return { engine, store, transport, scheduler, clock, statuses };
}

async function pendingDraft(
  store: ReturnType<typeof createMemoryArticleDraftStore>,
): Promise<PendingArticleEdit | null> {
  return store.load("01J8ZZ", "zh");
}

describe("article sync engine", () => {
  it("stays idle when there is nothing pending", async () => {
    const { engine, transport } = createFixture();

    await expect(engine.start(SERVER)).resolves.toEqual({ kind: "clean" });
    expect(engine.status()).toBe("idle");
    expect(transport.calls).toEqual([]);
  });

  it("persists an edit locally and only then reaches the server", async () => {
    const { engine, store } = createFixture();
    await engine.start(SERVER);

    await engine.edit(CONTENT);

    expect(engine.status()).toBe("local");
    await expect(pendingDraft(store)).resolves.toEqual({
      articleId: "01J8ZZ",
      locale: "zh",
      baseVersion: 1,
      savedAt: "2025-06-15T08:30:00.000Z",
      ...CONTENT,
    });
  });

  it("saves against the base version and clears the local copy once the server acknowledges it", async () => {
    const { engine, store, transport } = createFixture();
    await engine.start(SERVER);
    await engine.edit(CONTENT);
    transport.reply({ kind: "saved", translation: { ...CONTENT, version: 2 } });

    await engine.flushNow();

    expect(transport.calls).toEqual([expect.objectContaining({ baseVersion: 1, ...CONTENT })]);
    await expect(pendingDraft(store)).resolves.toBeNull();
    expect(engine.status()).toBe("saved");
  });

  it("keeps the local copy and backs off when the network is down", async () => {
    const { engine, store, transport, scheduler } = createFixture();
    await engine.start(SERVER);
    await engine.edit(CONTENT);
    transport.reply({ kind: "unavailable" });

    await engine.flushNow();

    expect(engine.status()).toBe("offline");
    await expect(pendingDraft(store)).resolves.not.toBeNull();
    expect(scheduler.delays()).toEqual([1000]);

    transport.reply({ kind: "unavailable" });
    await engine.flushNow();
    expect(scheduler.delays()).toEqual([2000]);
  });

  it("caps the retry backoff", async () => {
    const { engine, transport, scheduler } = createFixture();
    await engine.start(SERVER);
    await engine.edit(CONTENT);

    for (let attempt = 0; attempt < 4; attempt += 1) {
      transport.reply({ kind: "unavailable" });
      await engine.flushNow();
    }

    expect(scheduler.delays()).toEqual([4000]);
  });

  it("flushes the queue by itself when the browser comes back online", async () => {
    const { engine, store, transport, scheduler } = createFixture();
    await engine.start(SERVER);
    await engine.edit(CONTENT);
    transport.reply({ kind: "unavailable" });
    await engine.flushNow();

    engine.setOnline(false);
    expect(engine.status()).toBe("offline");

    transport.reply({ kind: "saved", translation: { ...CONTENT, version: 2 } });
    engine.setOnline(true);
    await scheduler.run();

    await expect(pendingDraft(store)).resolves.toBeNull();
    expect(engine.status()).toBe("saved");
  });

  it("refuses to overwrite a server copy that moved on, and keeps the local bytes", async () => {
    const { engine, store, transport } = createFixture();
    await engine.start(SERVER);
    await engine.edit(CONTENT);
    transport.reply({
      kind: "stale",
      current: { version: 2, title: "Server copy", summary: "", bodyJson: DOC },
    });

    await engine.flushNow();

    expect(engine.status()).toBe("conflict");
    await expect(pendingDraft(store)).resolves.toEqual(expect.objectContaining(CONTENT));

    await engine.flushNow();
    expect(transport.calls).toHaveLength(1);
  });

  it("recovers unsynced bytes on open and syncs them without further action", async () => {
    const { engine, store, transport, scheduler } = createFixture();
    await store.save({
      articleId: "01J8ZZ",
      locale: "zh",
      baseVersion: 1,
      savedAt: "2025-06-15T08:29:00.000Z",
      ...CONTENT,
    });
    transport.reply({ kind: "saved", translation: { ...CONTENT, version: 2 } });

    const start = await engine.start(SERVER);

    expect(start).toEqual({
      kind: "recovered",
      draft: expect.objectContaining({ ...CONTENT, baseVersion: 1 }),
    });
    expect(engine.status()).toBe("local");

    await scheduler.run();
    await expect(pendingDraft(store)).resolves.toBeNull();
    expect(engine.status()).toBe("saved");
  });

  it("recovers bytes whose base version is unknown by asking the author, not by guessing", async () => {
    const { engine, store, transport } = createFixture();
    await store.save({
      articleId: "01J8ZZ",
      locale: "zh",
      baseVersion: 0,
      savedAt: "2025-06-15T08:29:00.000Z",
      ...CONTENT,
    });

    const start = await engine.start(SERVER);

    expect(start).toEqual({ kind: "recovered", draft: expect.objectContaining(CONTENT) });
    expect(engine.status()).toBe("conflict");
    await engine.flushNow();
    expect(transport.calls).toEqual([]);
  });

  it("drops a recovered draft the server already holds without a pointless write", async () => {
    const { engine, store, transport } = createFixture();
    await store.save({
      articleId: "01J8ZZ",
      locale: "zh",
      baseVersion: 1,
      savedAt: "2025-06-15T08:29:00.000Z",
      title: SERVER.title,
      summary: SERVER.summary,
      bodyJson: SERVER.bodyJson,
    });

    await expect(engine.start(SERVER)).resolves.toEqual({ kind: "clean" });
    await expect(pendingDraft(store)).resolves.toBeNull();
    expect(engine.status()).toBe("saved");
    expect(transport.calls).toEqual([]);
  });

  it("discards the local copy without touching the server copy", async () => {
    const { engine, store, transport } = createFixture();
    await engine.start(SERVER);
    await engine.edit(CONTENT);
    transport.reply({ kind: "stale", current: { ...SERVER, version: 2, title: "Server copy" } });
    await engine.flushNow();

    await engine.discardLocal();

    await expect(pendingDraft(store)).resolves.toBeNull();
    expect(engine.status()).toBe("saved");
  });

  it("keeps an edit made while a save is in flight and pushes it against the new version", async () => {
    const { engine, store, transport, scheduler } = createFixture();
    await engine.start(SERVER);
    await engine.edit(CONTENT);
    const inFlight = transport.hold();
    const firstFlush = engine.flushNow();

    const later: ArticleEditContent = { title: "Later", summary: "", bodyJson: EDITED };
    await engine.edit(later);
    inFlight.resolve({ kind: "saved", translation: { ...CONTENT, version: 2 } });
    await firstFlush;

    expect(engine.status()).toBe("local");
    await expect(pendingDraft(store)).resolves.toEqual(
      expect.objectContaining({ ...later, baseVersion: 2 }),
    );

    transport.reply({ kind: "saved", translation: { ...later, version: 3 } });
    await scheduler.run();

    await expect(pendingDraft(store)).resolves.toBeNull();
    expect(engine.status()).toBe("saved");
    expect(transport.calls).toHaveLength(2);
  });

  it("reports status changes to its subscribers and stays quiet after disposal", async () => {
    const { engine, statuses, transport } = createFixture();
    await engine.start(SERVER);
    await engine.edit(CONTENT);
    transport.reply({ kind: "saved", translation: { ...CONTENT, version: 2 } });
    await engine.flushNow();

    expect(statuses).toEqual(["local", "syncing", "saved"]);

    engine.dispose();
    const before = statuses.length;
    await engine.edit({ ...CONTENT, title: "Ignored" });
    await engine.flushNow();
    expect(statuses).toHaveLength(before);
  });
});
