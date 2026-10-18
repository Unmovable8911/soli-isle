import { SESSION_COOKIE_NAME, SESSION_TTL_SECONDS } from "@/config/auth";
import { serializeSessionCookie, serializeSessionCookieClear } from "@/domain/session-cookie";
import { clientAddress, forwardedProtocol } from "@/domain/urls";
import {
  loginAuthor,
  revokeAllAuthorSessions,
  verifyAuthorSession,
  type AuthorAuthContext,
} from "@/services/auth";
import { NextResponse } from "next/server";
import { readCookieValue } from "./request-cookie";

export async function loginResponse(
  auth: AuthorAuthContext,
  request: Request,
): Promise<Response> {
  const formData = await request.formData();
  const passwordValue = formData.get("password");
  const password = typeof passwordValue === "string" ? passwordValue : "";
  const totpCodeValue = formData.get("totpCode");
  const totpCode = typeof totpCodeValue === "string" && totpCodeValue !== "" ? totpCodeValue : undefined;
  const secure = forwardedProtocol(request.headers) === "https";

  const outcome = await loginAuthor(auth, {
    password,
    totpCode,
    source: clientAddress(request.headers),
    userAgent: request.headers.get("user-agent"),
  });

  if (!outcome.ok) {
    if (outcome.reason === "rate-limited") {
      return NextResponse.redirect(new URL("/admin/login?error=rate-limited", request.url), {
        status: 303,
        headers:
          outcome.retryAfterSeconds !== undefined
            ? { "retry-after": String(outcome.retryAfterSeconds) }
            : undefined,
      });
    }
    return NextResponse.redirect(new URL("/admin/login?error=invalid", request.url), 303);
  }

  return NextResponse.redirect(new URL("/admin", request.url), {
    status: 303,
    headers: {
      "set-cookie": serializeSessionCookie(
        SESSION_COOKIE_NAME,
        outcome.sessionId,
        SESSION_TTL_SECONDS,
        secure,
      ),
    },
  });
}

export async function logoutResponse(
  auth: AuthorAuthContext,
  request: Request,
): Promise<Response> {
  const sessionId = readCookieValue(request.headers.get("cookie"), SESSION_COOKIE_NAME);
  if (sessionId === null || verifyAuthorSession(auth, sessionId) === null) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  revokeAllAuthorSessions(auth);
  return NextResponse.redirect(new URL("/admin/login", request.url), {
    status: 303,
    headers: {
      "set-cookie": serializeSessionCookieClear(
        SESSION_COOKIE_NAME,
        forwardedProtocol(request.headers) === "https",
      ),
    },
  });
}
