# CLAUDE.md

Working notes for agents in this repo. User-facing setup lives in `README.md`; this
file captures conventions, gotchas, and current state.

## What this is

Soli Isle — a multilingual personal blog. Monorepo:
- `backend/` — Fastify + Drizzle + SQLite API.
- `frontend/` — Vite + React 19 + React Router 7 SPA (TanStack Query, TipTap).
- `docs/` — `specs.md` (architecture) and `superpowers/{specs,plans}` (design + impl plans).

Four content types — **articles, moments, resources, pages** — each with a parallel
translation table (i18n). Single admin user; public SPA consumes the API.

## Commands

```bash
# Backend (run from backend/)
ADMIN_PASSWORD=admin SESSION_SECRET=dev-secret-must-be-32-chars-long!! npx tsx src/index.ts
npm run db:migrate     # apply migrations   npm run db:seed   # FRESH db only (inserts unconditionally)
npm run db:generate    # generate a migration after a schema change
npm test               # Vitest (in-memory SQLite)

# Frontend (run from frontend/)
npm run dev            # :5173, proxies /api + /media -> :3000 (backend must be up)
npm run build          # tsc && vite build
npm test               # Vitest + Testing Library (jsdom)
```

Env (backend `src/config.ts`): `ADMIN_PASSWORD` (required), `SESSION_SECRET`, `PORT`
(3000), `HOST`, `DB_PATH` (./data/soli-isle.db), `MEDIA_DIR`.

## Frontend conventions

- **Local imports use `.js` extensions** (e.g. `import { X } from './foo.js'`), even for `.ts`/`.tsx`.
- **CSS is a design-token system** in `src/styles/` (`tokens, base, components, public,
  admin, motion`), imported by `src/index.css`. Use ONLY the semantic tokens:
  `--color-*` (bg/surface/elevated/text/muted/border/accent/accent-hover/accent-soft/
  danger/focus), `--font-display|ui|read|mono`, `--space-*`, `--radius`/`--radius-sm`,
  `--ease`, `--spring`, `--shadow-sm|md`, `--content-width`/`--wide-width`/`--header-height`.
  Do **not** reintroduce the old Riso tokens (`--bg`, `--ink`, `--paper`, `--line`, bare `--accent`).
- **Theming**: `data-theme="light|dark"` on `<html>`. `ThemeProvider` (src/contexts/
  ThemeContext.tsx) resolves stored choice → OS preference → light; an inline no-flash
  script in `index.html` sets it before hydration. Admin uses the SAME tokens (no
  separate palette).
- Fonts are self-hosted via Fontsource (Fraunces, Schibsted Grotesk, Newsreader, Space Mono).
- Reusable class vocabulary in `components.css`: `.btn`(`--ghost`/`--danger`/`--sm`),
  `.card`(`--interactive`), `.eyebrow`, `.meta`, `.chip`, `.badge`, `.field`, `.empty-state`,
  `.skeleton`. Motion via `.reveal`+`useScrollReveal`; View Transitions enabled by the
  `viewTransition` prop on masthead nav links.

## Backend conventions / gotchas

- Routes are `FastifyPluginAsync` in `src/routes/{public,admin}/*.ts`. **Register every
  route in BOTH `src/app.ts` AND `tests/helpers.ts`** (the test harness builds its own
  app — forgetting helpers.ts → 401/404 in tests).
- `/api/admin/*` is auto-protected by an `onRequest` hook (except `/login` and `/me`).
- Drizzle schema: one table per file in `src/db/schema/`, re-exported from `index.ts`.
  After editing schema, run `npm run db:generate`.
- **The real migration has NO `ON DELETE CASCADE`.** DELETE handlers must remove child
  rows (translations, tags) before the parent. Keep `tests/helpers.ts` `ALL_TABLES_SQL`
  in sync with the real migration (also no cascade) so tests catch FK issues.
- Admin list endpoints left-join the **default-language** translation for display
  titles; a non-matching sentinel id is used when no default language exists (prevents
  duplicate rows).
- **i18n param**: `src/api/client.ts` must NOT append the visitor's `?lang=` to
  `/admin/*` requests (admin needs all translations).

## Current state (2026-05-30)

Full frontend redesign + admin-managed social links feature are **implemented on branch
`frontend-redesign`** (~29 commits ahead of `main`, not yet merged). Backend 78 tests +
frontend 18 tests + production build all green. The audit fixed real pre-existing bugs
(blank admin list titles, cascade-less deletes, `?lang=` admin leak). Spec/plan:
`docs/superpowers/{specs,plans}/2026-05-30-frontend-redesign*`.

Pending: a manual browser visual QA pass (light/dark/mobile) was not done; and an
integration decision (merge / PR) for the branch.
