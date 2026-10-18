export const articleConfig = {
  /** Edit-time snapshots are throttled: at most one automatic Revision per window. */
  automaticRevisionIntervalMs: 5 * 60 * 1000,
  /** "Keep every publish snapshot plus the latest N automatic ones". */
  automaticRevisionKeep: 20,
  /** Client autosave cadence: browser-local first, then this throttle to the server. */
  autosaveThrottleMs: 2_000,
} as const;
