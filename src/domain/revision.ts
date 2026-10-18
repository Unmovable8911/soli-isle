export const REVISION_KINDS = ["publish", "automatic"] as const;

export type RevisionKind = (typeof REVISION_KINDS)[number];

export interface RevisionRecord {
  id: string;
  kind: RevisionKind;
  createdAt: string;
}

export function isRevisionKind(value: string): value is RevisionKind {
  return (REVISION_KINDS as readonly string[]).includes(value);
}

/**
 * "Keep every publish snapshot plus the newest N automatic ones" — returns the
 * ids that fall outside the policy.
 */
export function selectPrunableRevisions(
  revisions: readonly RevisionRecord[],
  keepAutomatic: number,
): string[] {
  const automatic = revisions
    .filter((revision) => revision.kind === "automatic")
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

  return automatic
    .slice(Math.max(0, keepAutomatic))
    .reverse()
    .map((revision) => revision.id);
}

export function shouldCaptureAutomaticRevision(
  lastAutomaticAt: Date | null,
  now: Date,
  intervalMs: number,
): boolean {
  if (lastAutomaticAt === null) {
    return true;
  }
  return now.getTime() - lastAutomaticAt.getTime() >= intervalMs;
}
