# db

- **Purpose**: Owns the SQLite persistence layer — 20 Drizzle tables in `src/db/schema.ts`, the better-sqlite3 connection in `src/db/database.ts`, and the drizzle-kit migrations in `drizzle/` (0000–0006) that create them.
- **Key Files**:
  - `src/db/schema.ts` (20 Drizzle tables, indexes, constraints)
  - `src/db/database.ts` (better-sqlite3 connection, WAL pragmas)
  - `src/db/migrate.ts` (drizzle migrator wrapper)
  - `src/db/auth-repository.ts` (session and auth audit rows)
  - `src/db/database-health.ts` (SQLite AvailabilityProbe for health)
  - `drizzle.config.ts` (drizzle-kit schema path, `./drizzle` output)
  - `drizzle/` (SQL migrations 0000–0006 plus meta snapshots)
  - `drizzle/meta/_journal.json` (drizzle-kit migration journal)
- **Dependencies**: config, domain, services
- **Dependents**: scripts, server, services, test
- **Exposes**:
  - Connection: `openDatabase`, interfaces `DatabaseConnection` (`sqlite` + `db`) and `AppDatabase`.
  - Migrations: `runMigrations`.
  - Tables from `@/db/schema`: `article`, `articleTranslation`, `articleSlug`, `articleSlugHistory`, `articleRevision`, `articleTag`, `post`, `postTranslation`, `postImage`, `postTag`, `category`, `categoryTranslation`, `tag`, `tagTranslation`, `asset`, `assetVariant`, `assetReference`, `session`, `authAuditLog`, `healthCheck`.
  - Author-session persistence: `insertAuthorSession`, `findAuthorSession`, `updateAuthorSession`, `deleteAuthorSession`, `deleteAllAuthorSessions`, `insertAuditRecord`, `recentLoginFailures`, `clearLoginFailureRecords`.
  - Health: `createDatabaseAvailabilityProbe` returning `@/services/health`'s `AvailabilityProbe`.

## Data Flow
1. `src/server/app-context.ts:34` calls `openDatabase(paths.databasePath)`: `database.ts:18-30` creates the parent directory, opens better-sqlite3, sets `journal_mode = WAL` and `foreign_keys = ON`, then wraps it in Drizzle with the full schema.
2. `src/server/app-context.ts:37` calls `runMigrations(database.db, paths.migrationsDir)`, which applies the pending `drizzle/000N_*.sql` files and records them in `drizzle/meta/_journal.json`.
3. Services query the tables through `DatabaseConnection.db` (Drizzle) or `DatabaseConnection.sqlite` (raw pragmas/probes) — they never open a connection themselves.
4. `createDatabaseAvailabilityProbe` touches `health_check` row 1 and runs `SELECT 1`, feeding `getHealth` in `@/services/health`.
5. Schema edits flow outward: `drizzle-kit generate` diffs `drizzle.config.ts`'s `./src/db/schema.ts` into a new `drizzle/000N_*.sql` plus a meta snapshot.

## Internal Structure
- `schema.ts` (322 lines) groups tables by area: auth (`session`, `authAuditLog`, `healthCheck`), Asset (`asset`, `assetVariant`, `assetReference`), Article (`article`, `articleTranslation`, `articleSlug`, `articleSlugHistory`, `articleRevision`, `articleTag`), taxonomy (`category`, `categoryTranslation`, `tag`, `tagTranslation`), Post (`post`, `postTranslation`, `postImage`, `postTag`).
- Compound keys are `primaryKey({ columns })` on the translation and join tables; hot paths carry explicit indexes (`article_publication_state_idx`, `article_publish_time_idx`, `category_path_idx`, `tag_slug_idx`, `asset_reference_content_idx`).
- `auth-repository.ts` is the only place raw session/audit SQL lives; `database-health.ts` is the only place raw `health_check` SQL lives.
- Migrations are generated artefacts: `drizzle/0000_foundation.sql` through `drizzle/0006_article_cover.sql` with matching `drizzle/meta/000N_snapshot.json` files.
