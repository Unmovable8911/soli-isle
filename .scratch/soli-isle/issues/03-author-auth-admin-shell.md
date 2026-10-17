# 03: Author auth & admin shell

**What to build:** Only the Author can reach `/admin`. Password login checks an Argon2id hash that comes from deployment configuration; sessions are server-side records with 30-day rolling expiry; logout and password reset invalidate all sessions. Login failures are rate-limited per source and globally and leave an audit trace. Admin pages are protected by middleware, and every write endpoint verifies the session itself — neither replaces the other. Two CLI commands manage the password: hash and reset. There is no user table and no registration path anywhere.

**Blocked by:** 01 — Project foundation & ops contract

**Status:** ready-for-human

- [x] Login works at the single fixed admin path; success sets a cookie (`HttpOnly`, `Secure`, `SameSite=Lax`) carrying only an unguessable session identifier.
- [x] Sessions are server-side records with 30-day rolling expiry; logout and password reset invalidate every session for the Author.
- [x] Login failures are rate-limited per source and globally with escalating backoff, and each failure is written to an audit record.
- [x] An unauthenticated write request is rejected by the endpoint itself even if page-level middleware were misconfigured; unauthenticated visitors to admin pages are sent to login.
- [x] `hash-password` prints an Argon2id hash for use in configuration; `reset-password` replaces the configured hash and revokes all sessions.
- [x] A TOTP hook point exists but is disabled by default; the schema contains no user table and no second-person registration path.

## Comments

Implemented on the Next.js 15 foundation.

- **Auth core**: `src/config/auth.ts` (env `AUTHOR_PASSWORD_HASH` / `AUTHOR_TOTP_SECRET`, throttle defaults), Argon2id m=19456/t=2/p=1 in `src/security/password-hash.ts`, `src/services/auth.ts` (loginAuthor / verifyAuthorSession / revokeAllAuthorSessions / clearLoginFailures / createAuthorAuthContext), Drizzle `session` + `auth_audit_log` tables (migration 0001). No user table, no registration path anywhere.
- **Sessions**: 32-byte random base64url identifier; server-side rows with 30-day rolling expiry (extended on every verified use, expired rows self-delete); logout and `reset-password` revoke every session; cookie `soli-session` is `HttpOnly` + `SameSite=Lax` + `Path=/` + `Secure` only when the trusted `X-Forwarded-Proto` is https, so plain-HTTP local development still works.
- **Rate limiting & audit**: per-source and global dimensions derived from the audit log (survives restart); escalating backoff (30s base doubling, 30min cap per source; 5min base global, 60min cap); every failed and every rate-limited attempt is written to `auth_audit_log`.
- **HTTP layer**: middleware guards `/admin` pages (GET/HEAD without cookie → 307 `/admin/login`; writes pass through so each endpoint returns its own 401); the admin console layout re-verifies the session against the database; `POST /admin/logout` independently verifies the session (401 `{"error":"unauthorized"}`); login POST lives at `/admin/login/submit` because Next.js forbids a page and a route on the same path — `/admin/login` remains the single fixed login entry.
- **Admin shell**: login page + console placeholder under `/admin` via route groups; UI language follows the `soli-locale` cookie / `Accept-Language`; strings in the `admin` namespace of `messages/{zh,en}.json`.
- **CLI**: `npm run auth:hash-password` prints a PHC hash; `npm run auth:reset-password` atomically rewrites `.env`, revokes all sessions, and clears failed-login audit records so the Author is never locked out by backoff after a reset. `.env.example` and `docker-compose.yml` carry `AUTHOR_PASSWORD_HASH`.
- **TOTP hook**: `AuthorAuthContext.totpVerifier` seam, disabled by default (`null` in AppContext); no TOTP implementation shipped.
- Decisions confirmed with the user before implementation: conditional `Secure` cookie; admin UI locale follows cookie/`Accept-Language`; `reset-password` writes `.env` directly; throttle state derived from audit records.
- Validation: `tsc` clean, `eslint` 0 errors, 126/126 Vitest, `next build`, and a live `next start` smoke covering login, cookie attributes, rolling refresh, per-source backoff with `Retry-After`, page redirects, endpoint 401s, database session revocation and audit rows.
