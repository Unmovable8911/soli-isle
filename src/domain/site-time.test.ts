import { describe, expect, it } from "vitest";

import { instantToSiteLocal, siteLocalToInstant } from "./site-time";

describe("site time", () => {
  it("reads a wall-clock time in the site timezone as an instant", () => {
    expect(siteLocalToInstant("2025-07-01T09:00", "Asia/Shanghai")?.toISOString()).toBe(
      "2025-07-01T01:00:00.000Z",
    );
  });

  it("formats an instant as the wall-clock time of the site timezone", () => {
    expect(instantToSiteLocal(new Date("2025-07-01T01:00:00.000Z"), "Asia/Shanghai")).toBe(
      "2025-07-01T09:00",
    );
  });

  it("defaults to the single configured site timezone", () => {
    expect(siteLocalToInstant("2025-07-01T09:00")?.toISOString()).toBe(
      "2025-07-01T01:00:00.000Z",
    );
  });

  it("round-trips through a daylight saving transition", () => {
    expect(instantToSiteLocal(new Date("2025-03-09T06:30:00.000Z"), "America/New_York")).toBe(
      "2025-03-09T01:30",
    );
    expect(instantToSiteLocal(new Date("2025-03-09T07:30:00.000Z"), "America/New_York")).toBe(
      "2025-03-09T03:30",
    );
    expect(siteLocalToInstant("2025-03-09T01:30", "America/New_York")?.toISOString()).toBe(
      "2025-03-09T06:30:00.000Z",
    );
    expect(siteLocalToInstant("2025-03-09T03:30", "America/New_York")?.toISOString()).toBe(
      "2025-03-09T07:30:00.000Z",
    );
  });

  it("rejects values that are not wall-clock times", () => {
    for (const value of ["", "tomorrow", "2025-07-01", "2025-07-01T09", "2025-13-01T09:00"]) {
      expect(siteLocalToInstant(value, "Asia/Shanghai")).toBeNull();
    }
  });
});
