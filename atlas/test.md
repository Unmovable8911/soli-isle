# test

- **Purpose**: Provides `createTestHarness` — an in-memory SQLite `DatabaseConnection` migrated from `drizzle/`, a fixed `Clock` at 2025-06-15T08:30:00.000Z and a temporary `FileSystemResourceStorage` — plus probe stubs and the Vitest `server-only` stand-in.
- **Key Files**:
  - `src/test/harness.ts` (createTestHarness, TestHarness shape)
  - `src/test/harness.test.ts` (harness behaviour tests)
  - `src/test/availability-probes.ts` (passing and failing probe stubs)
  - `src/test/server-only.ts` (Vitest stand-in for `server-only`)
  - `vitest.config.ts` (Vitest include globs, `@` and `server-only` aliases)
- **Dependencies**: db, domain, services, storage
- **Dependents**: none
- **Exposes**:
  - Harness: `createTestHarness`, interfaces `TestHarness` and `TestHarnessOptions`.
  - Probes for `@/services/health`'s `AvailabilityProbe`: `availableProbe` (resolves) and `unavailableProbe` (throws `unavailable`).
  - `server-only`: the module `vitest.config.ts` resolves the bare `server-only` specifier to (`export {}`).

## Data Flow
1. `createTestHarness(options)` mkdtemps `soli-isle-test-*` and opens `openDatabase(":memory:")`.
2. It resolves `migrationsDir` (default `<cwd>/drizzle`), applies `runMigrations(database.db, migrationsDir)`, then awaits the optional `seed(database.db)` callback.
3. It returns `{ database, clock: fixedClock(now ?? 2025-06-15T08:30:00.000Z), resources: { rootDir, storage: new FileSystemResourceStorage(rootDir) }, migrationsDir, close }`.
4. `close()` closes SQLite if still open and removes the temp root; a failed migration or seed also closes and removes before rethrowing.

## Internal Structure
- The harness is the only fixture builder in the repo: every `src/services/*.test.ts`, `src/db/migrate.test.ts`, `src/http/*.test.ts` and `src/server/demo-seed.test.ts` calls it instead of composing `openDatabase` + `runMigrations` by hand.
- `vitest.config.ts` owns two aliases that make the module usable: `@` → `./src` and `server-only` → `./src/test/server-only.ts`; the real package throws outside a React Server Component.
- `harness.test.ts` is kept beside the harness because this module is test tooling rather than product code.
