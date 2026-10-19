# config

- **Purpose**: Single source of truth for compile-time site constants — `siteConfig` (Locale list, default Locale, time zone), the session-cookie name and TTL, auth throttle defaults, Article revision timing — plus the two `process.env` resolvers `resolveAuthConfig` and `resolveRuntimePaths`.
- **Key Files**:
  - `src/config/site.ts` (Locale type, locale guard)
  - `src/config/auth.ts` (session cookie, auth config)
  - `src/config/runtime.ts` (database, resource, migrations paths)
  - `src/config/article.ts` (revision and autosave timing)
  - `src/config/env-file.ts` (`.env` parse and in-place upsert)
- **Dependencies**: domain
- **Dependents**: app, app-admin, app-locale, components, components-admin, db, domain, http, messages, scripts, server, services
- **Exposes**:
  - Locale contract: `siteConfig` (`locales: ["zh","en"]`, `defaultLocale: "zh"`, `timeZone: "Asia/Shanghai"`), `type Locale`, `isLocale(value)` type guard.
  - Session surface: `SESSION_COOKIE_NAME` (`"soli-session"`), `SESSION_TTL_DAYS` (30), `SESSION_TTL_SECONDS`; read by `src/middleware.ts`, `src/http/admin-auth.ts`, the admin console layouts.
  - Auth config: `type AuthorAuthConfig`, `resolveAuthConfig(env)` — reads `AUTHOR_PASSWORD_HASH` / `AUTHOR_TOTP_SECRET` (trimmed empty string becomes `null`) and layers throttle windows over `ThrottleConfig` from `@/domain/throttle`.
  - Runtime paths: `type RuntimePaths` (`databasePath`, `resourceDir`, `migrationsDir`), `resolveRuntimePaths(env, cwd)`; defaults `data/database/soli-isle.sqlite`, `data/images`, `drizzle`, with `:memory:` passed through unresolved.
  - Editor timing: `articleConfig` (`automaticRevisionIntervalMs` 5 min, `automaticRevisionKeep` 20, `autosaveThrottleMs` 2000, sync retry 2000→30000 ms).
  - Env-file editing: `parseEnvFile(content)`, `upsertEnvValue(content, key, value)` — used only by `scripts/reset-password.ts`, never inside `src/`.
