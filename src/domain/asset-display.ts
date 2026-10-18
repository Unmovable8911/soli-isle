import { siteConfig, type Locale } from "@/config/site";

const KIBIBYTE = 1024;
const MEBIBYTE = KIBIBYTE * 1024;
const GIBIBYTE = MEBIBYTE * 1024;

/**
 * Renders a byte count with binary units. Values below one kibibyte stay exact;
 * every scaled unit keeps exactly one decimal place so columns line up.
 */
export function formatByteSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }
  if (bytes < KIBIBYTE) {
    return `${Math.round(bytes)} B`;
  }
  if (bytes < MEBIBYTE) {
    return `${(bytes / KIBIBYTE).toFixed(1)} KB`;
  }
  if (bytes < GIBIBYTE) {
    return `${(bytes / MEBIBYTE).toFixed(1)} MB`;
  }
  return `${(bytes / GIBIBYTE).toFixed(1)} GB`;
}

const INTL_LOCALE_TAG: Record<Locale, string> = { zh: "zh-CN", en: "en-US" };

const UPLOADED_AT_OPTIONS: Intl.DateTimeFormatOptions = {
  timeZone: siteConfig.timeZone,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
};

const formatters = new Map<Locale, Intl.DateTimeFormat>();

function formatterFor(locale: Locale): Intl.DateTimeFormat {
  const cached = formatters.get(locale);
  if (cached !== undefined) {
    return cached;
  }
  const formatter = new Intl.DateTimeFormat(INTL_LOCALE_TAG[locale], UPLOADED_AT_OPTIONS);
  formatters.set(locale, formatter);
  return formatter;
}

/**
 * Formats an upload instant in the site time zone. The parts are assembled by
 * hand instead of trusting ICU's locale pattern so the output stays stable.
 */
export function formatUploadedAt(iso: string, locale: Locale): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const parts = new Map(
    formatterFor(locale)
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );
  const year = parts.get("year") ?? "";
  const month = parts.get("month") ?? "";
  const day = parts.get("day") ?? "";
  const hour = parts.get("hour") ?? "";
  const minute = parts.get("minute") ?? "";

  return locale === "zh"
    ? `${year}-${month}-${day} ${hour}:${minute}`
    : `${month}/${day}/${year}, ${hour}:${minute}`;
}

export type UploadFailureKey = "unsupportedType" | "tooLarge" | "invalidImage" | "failed";

/**
 * Turns the admin upload endpoint's status and `error` code into a translation
 * key. The status is the primary signal; the code covers generic statuses.
 */
export function uploadFailureKey(status: number, errorCode: string | null): UploadFailureKey {
  if (status === 415 || errorCode === "unsupported-type") {
    return "unsupportedType";
  }
  if (status === 413 || errorCode === "too-large") {
    return "tooLarge";
  }
  if (status === 422 || errorCode === "invalid-image") {
    return "invalidImage";
  }
  return "failed";
}
