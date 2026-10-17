# 03: Author auth & admin shell

**What to build:** Only the Author can reach `/admin`. Password login checks an Argon2id hash that comes from deployment configuration; sessions are server-side records with 30-day rolling expiry; logout and password reset invalidate all sessions. Login failures are rate-limited per source and globally and leave an audit trace. Admin pages are protected by middleware, and every write endpoint verifies the session itself — neither replaces the other. Two CLI commands manage the password: hash and reset. There is no user table and no registration path anywhere.

**Blocked by:** 01 — Project foundation & ops contract

**Status:** ready-for-agent

- [ ] Login works at the single fixed admin path; success sets a cookie (`HttpOnly`, `Secure`, `SameSite=Lax`) carrying only an unguessable session identifier.
- [ ] Sessions are server-side records with 30-day rolling expiry; logout and password reset invalidate every session for the Author.
- [ ] Login failures are rate-limited per source and globally with escalating backoff, and each failure is written to an audit record.
- [ ] An unauthenticated write request is rejected by the endpoint itself even if page-level middleware were misconfigured; unauthenticated visitors to admin pages are sent to login.
- [ ] `hash-password` prints an Argon2id hash for use in configuration; `reset-password` replaces the configured hash and revokes all sessions.
- [ ] A TOTP hook point exists but is disabled by default; the schema contains no user table and no second-person registration path.
