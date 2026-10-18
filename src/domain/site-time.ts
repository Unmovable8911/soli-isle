import { siteConfig } from "@/config/site";

const LOCAL_PATTERN = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/;

export const SITE_LOCAL_FORMAT_HINT = "YYYY-MM-DDTHH:mm";

interface WallClockParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function formatWallClock(instant: Date, timeZone: string): WallClockParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const parts = new Map(formatter.formatToParts(instant).map((part) => [part.type, part.value]));

  return {
    year: Number(parts.get("year")),
    month: Number(parts.get("month")),
    day: Number(parts.get("day")),
    hour: Number(parts.get("hour")),
    minute: Number(parts.get("minute")),
    second: Number(parts.get("second")),
  };
}

function offsetMs(instant: Date, timeZone: string): number {
  const wallClock = formatWallClock(instant, timeZone);
  const asUtc = Date.UTC(
    wallClock.year,
    wallClock.month - 1,
    wallClock.day,
    wallClock.hour,
    wallClock.minute,
    wallClock.second,
  );
  return asUtc - instant.getTime();
}

/**
 * Reads a wall-clock value ("YYYY-MM-DDTHH:mm", the shape a `datetime-local`
 * input produces) as an instant in the given timezone. Returns null when the
 * value is not a wall-clock time or does not exist in that timezone.
 */
export function siteLocalToInstant(
  value: string,
  timeZone: string = siteConfig.timeZone,
): Date | null {
  const match = LOCAL_PATTERN.exec(value.trim());
  if (match === null) {
    return null;
  }

  const [, year, month, day, hour, minute, second] = match;
  const parts: WallClockParts = {
    year: Number(year),
    month: Number(month),
    day: Number(day),
    hour: Number(hour),
    minute: Number(minute),
    second: Number(second ?? "0"),
  };

  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );

  let instant = new Date(asUtc - offsetMs(new Date(asUtc), timeZone));
  const corrected = new Date(asUtc - offsetMs(instant, timeZone));
  if (corrected.getTime() !== instant.getTime()) {
    instant = corrected;
  }

  const roundTrip = formatWallClock(instant, timeZone);
  if (
    roundTrip.year !== parts.year ||
    roundTrip.month !== parts.month ||
    roundTrip.day !== parts.day ||
    roundTrip.hour !== parts.hour ||
    roundTrip.minute !== parts.minute
  ) {
    return null;
  }

  return instant;
}

/** Formats an instant as "YYYY-MM-DDTHH:mm" in the given timezone. */
export function instantToSiteLocal(
  instant: Date,
  timeZone: string = siteConfig.timeZone,
): string {
  const wallClock = formatWallClock(instant, timeZone);
  const pad = (value: number) => String(value).padStart(2, "0");

  return `${String(wallClock.year).padStart(4, "0")}-${pad(wallClock.month)}-${pad(
    wallClock.day,
  )}T${pad(wallClock.hour)}:${pad(wallClock.minute)}`;
}
