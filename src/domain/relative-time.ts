import type { Locale } from "@/config/site";
import { INTL_LOCALE_TAG } from "./article-time";
import { instantToSiteLocal } from "./site-time";

/**
 * Reader-facing relative time for the Frozen Feed cards.
 *
 * The value is computed once, by the server, while the page or the "load
 * older" page is rendered — nothing here is a live clock, and nothing
 * re-computes it in the browser. A card therefore cannot start claiming "1
 * minute ago" a minute after the Reader arrived.
 */
export type RelativeTimeUnit = "second" | "minute" | "hour" | "day" | "month" | "year";

export interface RelativeTimeParts {
  /** Signed, so a future instant reads forwards: -3 minutes is "3 minutes ago". */
  value: number;
  unit: RelativeTimeUnit;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const MONTH = 30.44 * DAY;
const YEAR = 365.25 * DAY;

/** Under this, the exact unit would be noise: the Feed says "now". */
const NOW_THRESHOLD = 45_000;

/** Where one unit stops being the useful one and the next starts. */
const MINUTE_LIMIT = 45 * MINUTE;
const HOUR_LIMIT = 22 * HOUR;
const DAY_LIMIT = 26 * DAY;
const MONTH_LIMIT = 320 * DAY;

export function relativeTimeParts(instantMs: number, nowMs: number): RelativeTimeParts {
  const elapsed = nowMs - instantMs;
  const magnitude = Math.abs(elapsed);
  const sign = elapsed < 0 ? 1 : -1;

  if (magnitude < NOW_THRESHOLD) {
    return { value: 0, unit: "second" };
  }

  if (magnitude < MINUTE_LIMIT) {
    return { value: sign * Math.round(magnitude / MINUTE), unit: "minute" };
  }

  if (magnitude < HOUR_LIMIT) {
    return { value: sign * Math.round(magnitude / HOUR), unit: "hour" };
  }

  if (magnitude < DAY_LIMIT) {
    return { value: sign * Math.round(magnitude / DAY), unit: "day" };
  }

  if (magnitude < MONTH_LIMIT) {
    return { value: sign * Math.round(magnitude / MONTH), unit: "month" };
  }

  return { value: sign * Math.round(magnitude / YEAR), unit: "year" };
}

/** The card's visible label. Computed at render time and never refreshed. */
export function formatRelativeTime(iso: string, now: Date, locale: Locale): string {
  const instant = Date.parse(iso);
  if (Number.isNaN(instant)) {
    return "";
  }

  const { value, unit } = relativeTimeParts(instant, now.getTime());
  const formatter = new Intl.RelativeTimeFormat(INTL_LOCALE_TAG[locale], { numeric: "auto" });
  return formatter.format(value, unit);
}

/**
 * The `title` a Reader sees on hover: the exact minute, in a hardcoded
 * non-localised format so it cannot be confused with the relative label.
 */
export function formatAbsoluteMinute(iso: string): string {
  const instant = new Date(iso);
  if (Number.isNaN(instant.getTime())) {
    return "";
  }
  return instantToSiteLocal(instant).replace("T", " ");
}
