# server

- **Purpose**: `src/server/app-context.ts` is the composition root — it opens SQLite, runs migrations and wires config, db, clock, storage and the four services into one cached `AppContext` that every route and page reads from; `src/server/demo-seed.ts` fills a local database through those same services.
- **Key Files**:
  - `src/server/app-context.ts` (composition root, `createAppContext`/`getAppContext`)
  - `src/server/demo-seed.ts` (re-runnable local demo content)
- **Dependencies**: config, db, domain, services, storage
- **Dependents**: app, app-admin, app-api, app-locale, app-media, scripts
- **Exposes**:
  - The context type and its constructors: `AppContext` (`database`, `clock`, `storage`, `health`, `auth`, `assets`, `articles`, `posts`, `reading`), `createAppContext(env, cwd)`, `getAppContext()`.
  - Demo seeding: `seedDemo`, `DemoSeedContext`, `DemoSeedSummary`, `assertLocalSeed`, `parseSeedArguments`, `DemoSeedRefusedError` — consumed only by `scripts/seed-demo.ts`.

## Data Flow
1. `createAppContext(env, cwd)` resolves `databasePath`, `migrationsDir` and `resourceDir` through `resolveRuntimePaths` (`@/config/runtime`).
2. `openDatabase` runs before anything else, and `runMigrations` runs inside a `try` that closes the connection and rethrows on failure.
3. `FileSystemResourceStorage` is built over `resourceDir`; `resolveAuthConfig(env)` supplies the argon2 and session settings.
4. `createAssetContext` runs first because the Article and Post contexts take it as their third argument — that is the one ordering constraint in the file.
5. The five contexts share the single `DatabaseConnection` and `systemClock`; `getAppContext` memoises the result in `cachedContext` for the process lifetime.
6. `seedDemo` receives those contexts rather than a database handle, so seeded images go through `uploadAsset` and seeded bodies through the real renderer.
