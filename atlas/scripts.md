# scripts

- **Purpose**: Five `tsx` CLIs that prepare and repair a running site — apply migrations before boot, seed the demo walkthrough, and mint or reset the Author's Argon2id password hash.
- **Key Files**:
  - `scripts/migrate.ts` (applies migrations via app context)
  - `scripts/seed-demo.ts` (seeds demo Articles, Posts, images)
  - `scripts/hash-password.ts` (prints Argon2id hash to stdout)
  - `scripts/reset-password.ts` (writes hash to `.env`, revokes sessions)
  - `scripts/read-password.ts` (shared hidden password prompt helper)
- **Dependencies**: config, db, domain, security, server, services
- **Dependents**: none
- **Exposes**: Nothing outside `scripts/` imports it — these are CLI entry points invoked by npm, not an importable API. `package.json` wires four files: `predev` and `prestart` run `tsx scripts/migrate.ts` before `next dev`/`next start`, `db:migrate` runs the same file by hand, `seed:demo` → `tsx scripts/seed-demo.ts`, `auth:hash-password` → `tsx scripts/hash-password.ts`, `auth:reset-password` → `tsx scripts/reset-password.ts`. `scripts/read-password.ts` has no npm script; it is the internal helper shared by the two password CLIs. All exit non-zero on failure so a failed `predev` migration aborts the dev server start.

## Data Flow

1. **Boot migration**: `npm run dev`/`start` fires `predev`/`prestart` → `tsx scripts/migrate.ts` → `createAppContext()` opens SQLite and runs the drizzle migrator, then closes the connection; a throw sets `process.exitCode = 1` and stops the boot. `npm run db:migrate` replays the same file on demand.
2. **Demo seeding**: `npm run seed:demo` → `assertLocalSeed(process.env)` refuses a non-local target, `parseSeedArguments` takes an optional `--images <dir>` source directory, `seedDemo` writes Articles, Posts and generated images, then prints the database and resource paths.
3. **Hash minting**: `npm run auth:hash-password` → `readNewPassword()` reads a password from a hidden TTY prompt (or one piped line) → `hashPassword` → the hash goes to stdout for a human to paste into `AUTHOR_PASSWORD_HASH`. Nothing is written to disk.
4. **Live reset**: `npm run auth:reset-password` → prompt → hash → `upsertEnvValue` rewrites `AUTHOR_PASSWORD_HASH` in `./.env` atomically → reopens the real database, runs migrations → `revokeAllAuthorSessions` and `clearLoginFailures` log out every existing session.
5. **Partial failure**: step 4 writes `.env` before touching the database, so a database error leaves the fresh hash already installed and exits 1 with "sessions were not revoked" — the password is changed, old sessions stay alive.

## Internal Structure

- **`.env` is not auto-loaded.** `tsx` starts no dotenv loader, and only `scripts/reset-password.ts` reads the file itself: `envPath = path.join(cwd, ".env")` at `scripts/reset-password.ts:46`, `fs.readFileSync(envPath, "utf8")` at `scripts/reset-password.ts:47`, merged *under* the real environment at `scripts/reset-password.ts:52`. `seed:demo` and `auth:hash-password` therefore see only exported process env — an `AUTHOR_PASSWORD_HASH` or `DATABASE_PATH` sitting in `.env` is invisible to everything except the reset CLI.
- **`$` escaping is mandatory.** Both Next.js and Docker Compose expand `$` in `.env` values, and an Argon2id hash is mostly `$` separators; `scripts/reset-password.ts:24-26` backslash-escapes them before writing, so a hand-pasted raw hash gets corrupted on next read.
- **Write protocol.** `scripts/reset-password.ts:28-40` writes a `.${pid}.${Date.now()}.tmp` sibling and renames it over `.env`, preserving the existing file mode (default `0600`), so an interrupted reset cannot leave a truncated env file.
- **No `@/` alias by policy.** The scripts use relative `../src/...` specifiers on purpose (`scripts/seed-demo.ts:10-12`): tsx resolves the alias, but a script that only reads correctly under the bundler config is harder to debug.
