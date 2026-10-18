import { describe, expect, it } from "vitest";

import { archiveMonths, formatArchiveMonth, formatPublishDate } from "./article-time";

describe("publish time display", () => {
  it("reads the instant in the site time zone, not UTC", () => {
    // 20:00 UTC on the 30th is already the next day in Asia/Shanghai.
    expect(formatPublishDate("2025-06-30T20:00:00.000Z", "zh")).toContain("7");
    expect(formatPublishDate("2025-06-15T08:30:00.000Z", "en")).toContain("15");
  });

  it("localises the date for each locale", () => {
    expect(formatPublishDate("2025-06-15T08:30:00.000Z", "zh")).toBe("2025年6月15日");
    expect(formatPublishDate("2025-06-15T08:30:00.000Z", "en")).toBe("June 15, 2025");
  });

  it("returns an empty string for a value that is not an instant", () => {
    expect(formatPublishDate("not-a-date", "en")).toBe("");
  });

  it("labels an archive month", () => {
    expect(formatArchiveMonth(2025, 6, "zh")).toBe("2025年6月");
    expect(formatArchiveMonth(2025, 6, "en")).toBe("June 2025");
  });
});

describe("archive grouping", () => {
  // Asia/Shanghai is UTC+8 all year, so 2025-08-31T20:00Z is already September.
  const entries = [
    { id: "september-first", at: "2025-09-01T02:00:00.000Z" },
    { id: "september-from-august", at: "2025-08-31T20:00:00.000Z" },
    { id: "august", at: "2025-08-02T02:00:00.000Z" },
    { id: "previous-year", at: "2024-12-31T15:00:00.000Z" },
  ];

  it("groups by the site-time-zone month, newest month first", () => {
    const months = archiveMonths(entries, (entry) => entry.at);
    expect(months.map((month) => `${month.year}-${month.month}`)).toEqual([
      "2025-9",
      "2025-8",
      "2024-12",
    ]);
  });

  it("keeps the given order inside a month", () => {
    const months = archiveMonths(entries, (entry) => entry.at);
    const september = months.find((month) => month.year === 2025 && month.month === 9);
    expect(september?.items.map((entry) => entry.id)).toEqual([
      "september-first",
      "september-from-august",
    ]);
  });

  it("puts a UTC-December instant in December, the site month it falls in", () => {
    // 2024-12-31T15:00Z is 2024-12-31 23:00 in Shanghai: still December.
    const months = archiveMonths(entries, (entry) => entry.at);
    expect(months[months.length - 1]).toMatchObject({ year: 2024, month: 12 });
  });

  it("skips entries with no publish time", () => {
    expect(archiveMonths([{ at: null }], (entry) => entry.at)).toEqual([]);
  });
});
