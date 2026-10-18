import { describe, expect, it } from "vitest";

import {
  selectPrunableRevisions,
  shouldCaptureAutomaticRevision,
  type RevisionRecord,
} from "./revision";

function revision(id: string, kind: "publish" | "automatic", createdAt: string): RevisionRecord {
  return { id, kind, createdAt };
}

describe("revision pruning", () => {
  it("prunes nothing while the automatic snapshots fit the limit", () => {
    const revisions = [
      revision("a1", "automatic", "2025-06-15T08:00:00.000Z"),
      revision("a2", "automatic", "2025-06-15T08:10:00.000Z"),
    ];

    expect(selectPrunableRevisions(revisions, 5)).toEqual([]);
  });

  it("keeps the newest automatic snapshots and prunes the older ones", () => {
    const revisions = [
      revision("a1", "automatic", "2025-06-15T08:00:00.000Z"),
      revision("a2", "automatic", "2025-06-15T08:10:00.000Z"),
      revision("a3", "automatic", "2025-06-15T08:20:00.000Z"),
    ];

    expect(selectPrunableRevisions(revisions, 2)).toEqual(["a1"]);
  });

  it("keeps every publish snapshot no matter how old", () => {
    const revisions = [
      revision("p1", "publish", "2025-01-01T00:00:00.000Z"),
      revision("p2", "publish", "2025-02-01T00:00:00.000Z"),
      revision("a1", "automatic", "2025-06-15T08:00:00.000Z"),
      revision("a2", "automatic", "2025-06-15T08:10:00.000Z"),
      revision("a3", "automatic", "2025-06-15T08:20:00.000Z"),
    ];

    expect(selectPrunableRevisions(revisions, 1)).toEqual(["a1", "a2"]);
  });

  it("orders automatic snapshots by creation time rather than input order", () => {
    const revisions = [
      revision("a3", "automatic", "2025-06-15T08:20:00.000Z"),
      revision("a1", "automatic", "2025-06-15T08:00:00.000Z"),
      revision("a2", "automatic", "2025-06-15T08:10:00.000Z"),
    ];

    expect(selectPrunableRevisions(revisions, 1)).toEqual(["a1", "a2"]);
  });

  it("prunes nothing when no automatic snapshots may be kept", () => {
    expect(selectPrunableRevisions([revision("p1", "publish", "2025-01-01T00:00:00.000Z")], 0)).toEqual(
      [],
    );
    expect(
      selectPrunableRevisions([revision("a1", "automatic", "2025-01-01T00:00:00.000Z")], 0),
    ).toEqual(["a1"]);
  });
});

describe("automatic snapshot throttle", () => {
  const INTERVAL = 10 * 60 * 1000;
  const NOW = new Date("2025-06-15T08:30:00.000Z");

  it("captures the first edit snapshot of an article", () => {
    expect(shouldCaptureAutomaticRevision(null, NOW, INTERVAL)).toBe(true);
  });

  it("suppresses snapshots until the interval has elapsed", () => {
    expect(
      shouldCaptureAutomaticRevision(new Date("2025-06-15T08:25:00.000Z"), NOW, INTERVAL),
    ).toBe(false);
  });

  it("captures a snapshot once the interval has elapsed", () => {
    expect(
      shouldCaptureAutomaticRevision(new Date("2025-06-15T08:19:59.000Z"), NOW, INTERVAL),
    ).toBe(true);
    expect(
      shouldCaptureAutomaticRevision(new Date("2025-06-15T08:20:00.000Z"), NOW, INTERVAL),
    ).toBe(true);
  });
});
