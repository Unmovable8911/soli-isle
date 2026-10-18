import { SESSION_COOKIE_NAME } from "@/config/auth";
import { isLocale, type Locale } from "@/config/site";
import { siteLocalToInstant } from "@/domain/site-time";
import { verifyAuthorSession, type AuthorAuthContext } from "@/services/auth";
import { readCookieValue } from "./request-cookie";

export const NO_STORE = { "cache-control": "no-store" } as const;

export function jsonError(error: string, status: number): Response {
  return Response.json({ error }, { status, headers: NO_STORE });
}

export function jsonOk(payload: unknown, status = 200): Response {
  return Response.json(payload, { status, headers: NO_STORE });
}

export function isAuthorizedAuthor(auth: AuthorAuthContext, request: Request): boolean {
  const sessionId = readCookieValue(request.headers.get("cookie"), SESSION_COOKIE_NAME);
  return sessionId !== null && verifyAuthorSession(auth, sessionId) !== null;
}

export async function readJsonObject(
  request: Request,
): Promise<Record<string, unknown> | null> {
  try {
    const parsed: unknown = await request.json();
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return null;
    }
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function readLocale(value: unknown): Locale | null {
  return typeof value === "string" && isLocale(value) ? value : null;
}

export function readOptionalString(
  body: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = body[key];
  return typeof value === "string" ? value : undefined;
}

/** The version a save was derived from; the only accepted shape is a positive integer. */
export function readBaseVersion(body: Record<string, unknown>): number | null {
  const value = body.baseVersion;
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;
}

/** A list of ids, or null when the field is present but not a list of strings. */
export function readIdList(body: Record<string, unknown>, key: string): string[] | null {
  const value = body[key];
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    return null;
  }
  return value as string[];
}

/** Drops absent fields so a service only sees the properties the caller supplied. */
export function compact<T extends Record<string, unknown>>(input: T): T {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  ) as T;
}

/**
 * A publish time may arrive as a wall-clock value (what a `datetime-local`
 * input produces) — it is then read in the site timezone, never the browser's —
 * or as an absolute instant. Anything else is passed through for the service
 * to reject.
 */
export function publishTimeFromBody(value: unknown): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  if (typeof value !== "string") {
    return "not-an-instant";
  }
  const local = siteLocalToInstant(value);
  return local === null ? value : local.toISOString();
}
