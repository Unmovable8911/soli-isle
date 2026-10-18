import { siteConfig, type Locale } from "@/config/site";

const INTL_LOCALE_TAG: Record<Locale, string> = { zh: "zh-CN", en: "en-US" };

const DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  timeZone: siteConfig.timeZone,
  year: "numeric",
  month: "long",
  day: "numeric",
};

function dateFormatter(locale: Locale): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(INTL_LOCALE_TAG[locale], DATE_OPTIONS);
}

function monthFormatter(locale: Locale): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(INTL_LOCALE_TAG[locale], {
    timeZone: "UTC",
    year: "numeric",
    month: "long",
  });
}

/** A Publish Time as a Reader sees it: the site time zone, the Reader's Locale. */
export function formatPublishDate(iso: string, locale: Locale): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return dateFormatter(locale).format(date);
}

/** The month heading on the archive page. */
export function formatArchiveMonth(year: number, month: number, locale: Locale): string {
  return monthFormatter(locale).format(new Date(Date.UTC(year, month - 1, 1)));
}

export interface ArchiveMonth<T> {
  year: number;
  /** 1–12, as a reader counts months. */
  month: number;
  items: T[];
}

interface MonthSlot {
  year: number;
  month: number;
}

const wallClock = new Intl.DateTimeFormat("en-US", {
  timeZone: siteConfig.timeZone,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
});

function monthOf(iso: string): MonthSlot | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  const parts = new Map(
    wallClock.formatToParts(date).map((part) => [part.type, part.value]),
  );
  return { year: Number(parts.get("year")), month: Number(parts.get("month")) };
}

/**
 * Buckets already-ordered entries into site-time-zone months, newest month
 * first. Entries inside a month keep the order they arrived in, so the caller
 * decides whether that is newest-first or oldest-first.
 */
export function archiveMonths<T>(
  items: readonly T[],
  publishTimeOf: (item: T) => string | null,
): ArchiveMonth<T>[] {
  const months: ArchiveMonth<T>[] = [];

  for (const item of items) {
    const publishTime = publishTimeOf(item);
    if (publishTime === null) {
      continue;
    }
    const slot = monthOf(publishTime);
    if (slot === null) {
      continue;
    }
    const current = months[months.length - 1];
    if (current !== undefined && current.year === slot.year && current.month === slot.month) {
      current.items.push(item);
      continue;
    }
    months.push({ year: slot.year, month: slot.month, items: [item] });
  }

  return months.sort((left, right) => right.year - left.year || right.month - left.month);
}
