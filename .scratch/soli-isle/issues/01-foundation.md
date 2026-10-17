# 01: Project foundation & ops contract

**What to build:** The empty-but-runnable application. One command brings the whole site up in Docker Compose with persistent database and image volumes; a health endpoint reports real database and disk availability; the app listens on a plain HTTP port and trusts forwarded headers from an outer reverse proxy; a fresh database migrates cleanly on startup. The shared test harness (in-memory SQLite + fixed clock + temporary resource directory) and CI checks exist so every later ticket can verify behaviour.

**Blocked by:** None (can start immediately).

**Status:** ready-for-human

- [x] `docker compose up` starts the whole site with one command; data lives in two mountable volumes (database, images) so a backup is copying one directory.
- [x] The health endpoint reflects the real availability of the database and of the image storage.
- [x] The app listens only on a plain HTTP port, resolves and trusts `X-Forwarded-For` / `X-Forwarded-Proto`, and never emits an absolute URL containing a domain it was not given.
- [x] A fresh database runs all migrations on startup; a migration test asserts the schema a brand-new environment gets.
- [x] Site configuration holds exactly one list of supported Locales and one site timezone.
- [x] Vitest runs the shared test helper: in-memory SQLite with migrations applied + fixed clock + temporary resource directory.
- [x] CI gates lint, typecheck, and tests on every change.

## Comments

Implemented the Next.js 15/React 19/TypeScript foundation with Drizzle and better-sqlite3, startup migrations, persistent Compose storage, DB/disk health probes, forwarded-header normalization, URL origin hardening, the shared Vitest harness, and CI gates.

Validation in this environment: strict TypeScript checking passed using the cached compiler with framework type stubs; migration SQL, health-write semantics, URL/Host validation, proxy-header normalization, and YAML parsing were exercised directly. The full lint/Vitest suite and Docker Compose startup could not run because network access is disabled and the required dependencies are not present in the local cache. The checkout also has no writable Git metadata, so the work could not be committed.
