import { SESSION_COOKIE_NAME } from "@/config/auth";
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
