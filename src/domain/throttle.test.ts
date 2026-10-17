import { describe, expect, it } from "vitest";
import { loginRetryDelay } from "./throttle";

const MINUTE = 60_000;

describe("loginRetryDelay", () => {
  const windowMs = 15 * MINUTE;
  const threshold = 3;
  const backoffBaseMs = 30_000;
  const backoffCapMs = 30 * MINUTE;
  const now = new Date("2025-06-15T08:30:00.000Z");

  function at(msFromNow: number): Date {
    return new Date(now.getTime() + msFromNow);
  }

  function delay(failures: Date[], reference: Date = now): number | null {
    return loginRetryDelay(failures, reference, windowMs, threshold, backoffBaseMs, backoffCapMs);
  }

  it("does not throttle while failures stay below the threshold", () => {
    expect(delay([])).toBeNull();
    expect(delay([at(-1_000)])).toBeNull();
    expect(delay([at(-14 * MINUTE), at(-1_000)])).toBeNull();
  });

  it("counts only failures strictly inside the window", () => {
    const inside = [at(-14 * MINUTE), at(-1_000)];
    expect(delay([at(-windowMs), ...inside])).toBeNull();
    expect(delay([at(0), ...inside])).toBe(backoffBaseMs);
  });

  it("applies the base backoff from the most recent failure once the threshold is reached", () => {
    expect(delay([at(-10_000), at(-5_000), at(-2_000)])).toBe(30_000 - 2_000);
  });

  it("doubles the backoff for every failure beyond the threshold", () => {
    expect(delay([at(-10_000), at(-8_000), at(-6_000), at(-4_000)])).toBe(60_000 - 4_000);
    expect(delay([at(-10_000), at(-8_000), at(-6_000), at(-4_000), at(-2_000)])).toBe(
      120_000 - 2_000,
    );
  });

  it("caps the backoff at the configured maximum", () => {
    const capped = loginRetryDelay(
      [at(-100), at(-90), at(-80), at(-70), at(-60), at(-50)],
      now,
      windowMs,
      threshold,
      backoffBaseMs,
      90_000,
    );
    expect(capped).toBe(90_000 - 50);
  });

  it("returns zero once the computed backoff has fully elapsed", () => {
    expect(delay([at(-40_000), at(-35_000), at(-30_000)], at(0))).toBe(0);
    expect(delay([at(-40_000), at(-35_000), at(-30_000)], at(5_000))).toBe(0);
  });

  it("stops throttling once every failure has left the window", () => {
    expect(delay([at(-windowMs - 1), at(-windowMs - 500), at(-windowMs)], at(0))).toBeNull();
  });

  it("combines the global parameters with the same formula", () => {
    const globalNow = new Date("2025-06-15T08:30:00.000Z");
    const failures = Array.from({ length: 20 }, (_, index) => at(-(index + 1) * 1_000));

    const twenty = loginRetryDelay(failures, globalNow, 10 * MINUTE, 20, 5 * MINUTE, 60 * MINUTE);
    expect(twenty).toBe(5 * MINUTE - 1_000);

    const twentyTwo = loginRetryDelay(
      [...failures, at(-2_000), at(-3_000)],
      globalNow,
      10 * MINUTE,
      20,
      5 * MINUTE,
      60 * MINUTE,
    );
    expect(twentyTwo).toBe(20 * MINUTE - 1_000);

    const thirty = loginRetryDelay(
      Array.from({ length: 30 }, (_, index) => at(-(index + 1) * 1_000)),
      globalNow,
      10 * MINUTE,
      20,
      5 * MINUTE,
      60 * MINUTE,
    );
    expect(thirty).toBe(60 * MINUTE - 1_000);
  });
});
