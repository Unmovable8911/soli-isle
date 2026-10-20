# app

- **Purpose**: Owns the Next.js shell around every route: the Edge request pipeline in `src/middleware.ts`, the import-only stylesheet cascade rooted at `src/app/globals.css`, the pre-paint theme script, the full-document 404, and the indexable-Article sitemap.
- **Key Files**:
  - `src/middleware.ts` (locale, tombstone and auth pipeline)
  - `src/app/globals.css` (import-only stylesheet cascade)
  - `src/app/tokens.css` (eight colour roles, both themes)
  - `src/app/base.css` (reset, self-hosted faces, shell)
  - `src/app/theme-init.ts` (pre-paint theme script string)
  - `src/app/global-not-found.tsx` (full-document 404 shell)
  - `src/app/sitemap.ts` (indexable Article sitemap)
  - `src/app/globals-css.test.ts` (stylesheet contract audit)
- **Dependencies**: components, config, domain, http, messages, server, services
- **Dependents**: app-admin, app-locale
- **Exposes**:
  - Theme boot: `themeInitScript` from `src/app/theme-init.ts`, imported by `src/app/[locale]/layout.tsx:8` and `src/app/admin/admin-document.tsx:4` and injected as a blocking `<script data-theme-init>`.
  - Stylesheets: `src/app/globals.css` is imported for effect by the three root documents; it holds nothing but `@import` rules, and `tokens.css` is only reachable through it.
  - HTTP boundary: `middleware()` and its `config.matcher` (`/((?!_next/static|_next/image|favicon.ico).*)`) — no module imports it; every public and console request passes through it.

## Data Flow
1. Every request except `_next/static`, `_next/image` and `favicon.ico` enters `middleware(request)` in `src/middleware.ts`.
2. `/admin/login` passes straight through; any other `/admin*` GET or HEAD without `SESSION_COOKIE_NAME` is redirected 307 to `/admin/login`.
3. A GET or HEAD whose path parses as an Article (`parseArticlePath`) is checked against a 30-second tombstone cache; a hit answers `goneResponse(locale)` (410).
4. `decideLocaleRedirect` picks a Locale from the `soli-locale` cookie or `Accept-Language` and answers 307 to the prefixed path.
5. Otherwise `passThrough` normalizes proxy headers and publishes `LOCALE_HEADER` for the error and not-found boundaries; the admin branch additionally re-issues the session cookie for `SESSION_TTL_SECONDS`.
6. The route renders inside the `globals.css` cascade, `themeInitScript` sets `data-theme` on `documentElement` before first paint, and `sitemap()` maps `listIndexableArticlePaths` to `<url>`/`<lastmod>`.

## Internal Structure
There is no root layout directly under `src/app/`: three root documents each build their own `<html>` — `src/app/[locale]/layout.tsx` (public, in app-locale), `src/app/admin/login/layout.tsx` and `src/app/admin/(console)/layout.tsx` (console, in app-admin) — and `src/app/global-not-found.tsx` covers a `notFound()` that no single root layout can render.

Styling is a token cascade rather than modules: `tokens.css` declares `--bg`, `--surface`, `--fg`, `--muted`, `--border`, `--border-strong`, `--accent`, `--on-accent` under `:root` and `:root[data-theme="dark"]`, and is the only file allowed to hold a colour literal; `globals.css` only imports `tokens.css` → `base.css` → `reader/{shell,home,lists,article-body,article,feed}.css` → `admin/{shell,assets,articles,composer,dashboard}.css`. `globals-css.test.ts` reads that import list, so a layer added to the cascade is audited without being registered.

`src/middleware.ts` runs on the Edge and cannot read SQLite, so tombstones arrive over HTTP from `/api/public/gone-slugs` with a 1s timeout and `TOMBSTONE_TTL_MS = 30_000`; every failure fails open to a 404. `resetTombstoneCache()` is the test seam.

The `src/app/api/` and `src/app/media/` route handlers live inside this directory but are owned by `app-api` and `app-media`.
