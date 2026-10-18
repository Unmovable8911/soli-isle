import { describe, expect, it } from "vitest";

import { formatAbsoluteMinute, formatRelativeTime, relativeTimeParts } from "./relative-time";

const NOW = Date.parse("2025-06-15T08:30:00.000Z");
const SECOND = 1_000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function partsAgo(elapsedMs: number) {
  return relativeTimeParts(NOW - elapsedMs, NOW);
}

describe("relative time parts", () => {
  it("calls anything under three quarters of a minute 'now'", () => {
    expect(partsAgo(0)).toEqual({ value: 0, unit: "second" });
    expect(partsAgo(44_999)).toEqual({ value: 0, unit: "second" });
  });

  it("counts minutes up to the three-quarter-hour mark", () => {
    expect(partsAgo(45 * SECOND)).toEqual({ value: -1, unit: "minute" });
    expect(partsAgo(3 * MINUTE)).toEqual({ value: -3, unit: "minute" });
    expect(partsAgo(44 * MINUTE + 59 * SECOND)).toEqual({ value: -45, unit: "minute" });
  });

  it("switches to hours after forty-five minutes", () => {
    expect(partsAgo(45 * MINUTE)).toEqual({ value: -1, unit: "hour" });
    expect(partsAgo(90 * MINUTE)).toEqual({ value: -2, unit: "hour" });
    expect(partsAgo(21 * HOUR + 59 * MINUTE)).toEqual({ value: -22, unit: "hour" });
  });

  it("switches to days after twenty-two hours", () => {
    expect(partsAgo(22 * HOUR)).toEqual({ value: -1, unit: "day" });
    expect(partsAgo(3 * DAY)).toEqual({ value: -3, unit: "day" });
    expect(partsAgo(25 * DAY + 23 * HOUR)).toEqual({ value: -26, unit: "day" });
  });

  it("switches to months after twenty-six days and to years after three hundred and twenty", () => {
    expect(partsAgo(26 * DAY)).toEqual({ value: -1, unit: "month" });
    expect(partsAgo(60 * DAY)).toEqual({ value: -2, unit: "month" });
    expect(partsAgo(319 * DAY)).toEqual({ value: -10, unit: "month" });
    expect(partsAgo(320 * DAY)).toEqual({ value: -1, unit: "year" });
    expect(partsAgo(731 * DAY)).toEqual({ value: -2, unit: "year" });
  });

  it("keeps the sign so a future instant reads forwards", () => {
    expect(relativeTimeParts(NOW + 3 * HOUR, NOW)).toEqual({ value: 3, unit: "hour" });
  });
});

describe("relative time formatting", () => {
  it("formats a publish time in the Reader's Locale", () => {
    expect(formatRelativeTime("2025-06-15T05:30:00.000Z", new Date(NOW), "zh")).toBe("3小时前");
    expect(formatRelativeTime("2025-06-15T05:30:00.000Z", new Date(NOW), "en")).toBe("3 hours ago");
  });

  it("reads as a plain 'now' rather than '0 seconds ago'", () => {
    expect(formatRelativeTime("2025-06-15T08:29:30.000Z", new Date(NOW), "zh")).toBe("现在");
    expect(formatRelativeTime("2025-06-15T08:29:30.000Z", new Date(NOW), "en")).toBe("now");
  });

  it("returns nothing for a publish time that is not a date", () => {
    expect(formatRelativeTime("not-a-date", new Date(NOW), "en")).toBe("");
  });
});

describe("absolute minute format", () => {
  it("is a hardcoded, non-localised wall clock in the site time zone, to the minute", () => {
    // 2025-06-15T08:30Z is 16:30 in Asia/Shanghai, the site time zone.
    expect(formatAbsoluteMinute("2025-06-15T08:30:00.000Z")).toBe("2025-06-15 16:30");
    expect(formatAbsoluteMinute("2025-01-01T00:00:59.000Z")).toBe("2025-01-01 08:00");
  });

  it("has no output for an unusable instant", () => {
    expect(formatAbsoluteMinute("nope")).toBe("");
  });
});
