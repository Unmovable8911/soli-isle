# 02: Locale routing & site chrome

**What to build:** Every page lives under a Locale prefix. Visiting the bare domain lands the Reader on their best language and remembers a manual choice, while a prefixed URL always shows its own Locale. The header switcher swaps Locale and keeps the Reader on the same page. All interface text comes from one JSON per Locale; a missing key fails the build instead of silently falling back. Light/dark theme follows the system, can be overridden manually, is remembered long-term, and never flashes the wrong theme on load.

**Blocked by:** 01 — Project foundation & ops contract

**Status:** ready-for-agent

- [x] Prefixed URLs (e.g. `/zh`, `/en`) render the placeholder home in that Locale.
- [x] Bare-domain visits respond with a temporary redirect (not 301) to the Locale chosen by `Accept-Language`, preferring the cookie-stored choice when present.
- [x] A prefixed URL is never rewritten based on the cookie: the cookie only decides where the bare path lands.
- [x] The language switcher replaces only the Locale prefix and keeps the rest of the path and query.
- [x] Every UI string comes from the per-Locale JSON; omitting a key in any Locale fails the build, not the page.
- [x] Theme: first load follows the system with no wrong-theme flash; a manual override persists across visits and takes precedence over the system setting.

## Comments

Implemented on the Next.js 15 App Router foundation.

- **Routing**: bare paths 307-redirect to the Locale from the `soli-locale` cookie (preferred) or `Accept-Language` primary-subtag negotiation, falling back to the default Locale. Language-shaped prefixes (including unsupported ones, which 404 at the page layer) and `/api/*` / whitelisted static files are never rewritten. Pure logic lives in `src/domain/locale.ts` (28 unit tests), middleware stays thin (8 smoke tests with real `NextRequest`).
- **Chrome**: root layout moved to `src/app/[locale]/layout.tsx`; the header holds the site name, a locale switcher that swaps only the Locale prefix (`swapLocalePathname` + query re-attach, sets `soli-locale` cookie on click), and a three-state theme control (system/light/dark).
- **Messages**: `src/messages/{zh,en}.json`, `zh` is the structural source of truth; `Messages = typeof zh` binds `en` so a missing key fails `tsc`/`next build` (demonstrated with a temporary key removal).
- **Theme**: `soli-theme` in localStorage, inline `<head>` script (`data-theme-init`) resolves system preference before first paint, CSS variables per theme with `color-scheme`.
- Smoke-tested against `next build` + `next start`: both Locales render, 307 + cookie preference verified, prefixed URL immune to cookie, theme script in head. Gates: lint 0 errors, typecheck clean, 62/62 tests.
- Side fixes: baseline typecheck errors from issue 01 (`NODE_ENV` missing in `ProcessEnv` literals in two test files); `next-env.d.ts` added to ESLint ignores because Next 15.5 manages its route-types reference; `tsconfig.tsbuildinfo` / `.npm-cache/` gitignored; `package-lock.json` committed.
