# Project Atlas

## Project Summary

- **Description**: Single-author, bilingual (zh/en) blog. Long-form **Article**s carry a Category, Tags, a language-neutral Cover and one ArticleTranslation per Locale; short **Post**s have no title or Category and are read only in a reverse-chronological **Feed**. The Author is the deployment itself — there is exactly one login identity.
- **Tech Stack**: TypeScript 5.9 on Node ≥24 · Next.js 15.5 App Router + React 19 · SQLite via better-sqlite3 with Drizzle ORM · TipTap v3 (ProseMirror JSON is the stored body, Markdown a derived column) · shiki + KaTeX rendering · sharp image variants · argon2id auth · vitest + happy-dom · hand-written CSS token layers, no Tailwind.
- **Entry Points**: `src/middleware.ts` (Locale redirect, 410 tombstones, admin gate) · `src/app/[locale]/layout.tsx` (public document) · `src/app/admin/(console)/layout.tsx` (console document) · `src/server/app-context.ts` (`getAppContext()`, the composition root every page and route reads) · `src/app/api/**/route.ts` (JSON endpoints) · `scripts/migrate.ts` + `scripts/seed-demo.ts` + the three password CLIs, wired to `predev`/`prestart`.
- **Repo Docs**: `CONTEXT.md` (domain vocabulary — bind these terms, avoid its _Avoid_ lists) · `docs/adr/0001`–`0007` (decisions; 0005 and 0006 partly supersede 0001/0004) · `docs/specs/001-soli-isle.md` (user stories, layer seams, testing decisions) · `docs/agents/` (issue tracker, triage labels).

## Module Tree

- **app** — Owns the Next.js shell around every route: the Edge request pipeline in `src/middleware.ts`, the import-only stylesheet cascade rooted at `src/app/globals.css`, the pre-paint theme script, the full-document 404, and the indexable-Article sitemap. → `atlas/app.md`
  - **app-locale** — Renders every public reader route under the single `[locale]` dynamic segment — Home, Archive, Category tree, Article, Post Feed with its Tag filter, Search, and Tag listing — plus the Locale-scoped error and not-found boundaries. → `atlas/app-locale.md`
  - **app-admin** — Renders the Author's console under `/admin` — dashboard, Article editor, Post composer, Asset library, Category and Tag screens — plus the `/admin/login` and `/admin/logout` endpoints that guard it. → `atlas/app-admin.md`
  - **app-api** — Publishes 23 JSON `route.ts` endpoints under `/api` — admin CRUD for Articles, Posts, Assets, Categories and Tags, the public Feed and tombstoned Slug list, and the health probe. → `atlas/app-api.md`
  - **app-media** — Streams one stored Asset variant as immutable binary bytes at `GET /media/[assetId]/[variant]` by delegating to `mediaFileResponse(getAppContext().assets, assetId, variant)`. → `atlas/app-media.md`
- **components** — The public reader UI — `SiteShell` chrome wrapping the `ReaderHome`, `ArticleView`, `Feed`, `ArchiveIndex` and `CategoryPills` surfaces, plus the `ArticleCard`/`PostCard`/`Lightbox` primitives those surfaces compose. → `atlas/components.md`
  - **components-admin** — The Author's console UI — the TipTap `ArticleEditor` with its offline-first draft/sync path, `PostComposer`, the asset/Cover pickers, and the Article, Post, Category, Tag and dashboard management tables. → `atlas/components-admin.md`
- **http** — Turns a `Request` into a `Response` for every Article, Post, Asset, Category/Tag, session and health endpoint, orchestrating the services layer and never touching SQLite itself. → `atlas/http.md`
- **server** — `src/server/app-context.ts` is the composition root — it opens SQLite, runs migrations and wires config, db, clock, storage and the four services into one cached `AppContext` that every route and page reads from; `src/server/demo-seed.ts` fills a local database through those same services. → `atlas/server.md`
- **services** — Implements Article, Post, Category, Tag, Asset, Author-session and health operations over `src/db` and returns the view types that `src/http` and `src/app` render. → `atlas/services.md`
- **db** — Owns the SQLite persistence layer — 20 Drizzle tables in `src/db/schema.ts`, the better-sqlite3 connection in `src/db/database.ts`, and the drizzle-kit migrations in `drizzle/` (0000–0006) that create them. → `atlas/db.md`
- **storage** — Owns the two filesystem adapters that write under a single root directory — `AssetFileStore` places per-Asset variant image files and `FileSystemResourceStorage` proves the resource directory is writable and readable. → `atlas/storage.md`
- **domain** — Framework-free, I/O-light logic the whole app shares: 35 single-purpose modules over Locale negotiation, public URL and Slug addressing, Publication State visibility, Feed cursors, rich-text and table-of-contents parsing, and ULID/throttle/session-cookie primitives. → `atlas/domain.md`
- **config** — Single source of truth for compile-time site constants — `siteConfig` (Locale list, default Locale, time zone), the session-cookie name and TTL, auth throttle defaults, Article revision timing — plus the two `process.env` resolvers `resolveAuthConfig` and `resolveRuntimePaths`. → `atlas/config.md`
- **messages** — Exports the `messages` catalogue that maps every Locale to one nested `Messages` object holding the UI strings for `meta`, `chrome`, `home`, `admin` and `reader`. → `atlas/messages.md`
- **security** — Provides the Author's credential primitives — `hashPassword` produces an argon2id digest and `verifyPassword` checks a plaintext password against a stored digest without throwing. → `atlas/security.md`
- **editor** — `src/editor/extensions.ts` is the single Article body schema list that the admin editor, the Markdown derivation and the server renderer all read, and `src/editor/markdown.ts` turns ProseMirror JSON into the stored Markdown column and back for paste. → `atlas/editor.md`
  - **editor-nodes** — Supplies the Article body's own TipTap nodes — the toned Callout, the footnote reference/item/section trio and the `lineStart` helper their Markdown block tokenizers anchor on — on top of the stock extensions. → `atlas/editor-nodes.md`
  - **editor-render** — Renders stored ProseMirror JSON into the reader HTML — heading anchors, shiki-highlighted code, KaTeX math, footnote back-links and responsive image `srcset` — with no database or message access of its own. → `atlas/editor-render.md`
- **scripts** — Five `tsx` CLIs that prepare and repair a running site — apply migrations before boot, seed the demo walkthrough, and mint or reset the Author's Argon2id password hash. → `atlas/scripts.md`
- **test** — Provides `createTestHarness` — an in-memory SQLite `DatabaseConnection` migrated from `drizzle/`, a fixed `Clock` at 2025-06-15T08:30:00.000Z and a temporary `FileSystemResourceStorage` — plus probe stubs and the Vitest `server-only` stand-in. → `atlas/test.md`

## Data Flow

1. **Public page render** — `src/middleware.ts` resolves the Locale and gates `/admin*` → `src/app/[locale]/**/page.tsx` (`force-dynamic`, nodejs runtime) → `getAppContext()` → `src/services/reading.ts` → Drizzle queries on `src/db/schema.ts` over better-sqlite3 → body JSON rendered by `src/editor/render/render-article.ts` → `src/components/article-view.tsx`.
2. **Admin JSON write** — browser fetch → `src/app/api/admin/articles/[articleId]/route.ts` → `src/http/articles.ts` → `src/http/admin-json.ts` `isAuthorizedAuthor` (the session is re-verified on every write, not trusted from the middleware pass) → `src/services/articles.ts` → `src/db/*`.
3. **Editor save and sync** — `src/components/admin/article-editor.tsx` → `article-local-store.ts` (IndexedDB `soli-isle-editor`/`article-drafts`, key `${articleId}:${locale}`) → `article-sync-engine.ts` (throttle and backoff from `src/config/article.ts`) → `article-sync-transport.ts` → `PUT /api/admin/articles/{id}/translations/{locale}` carrying `baseVersion` → `src/domain/article-sync.ts` `reconcileArticleEdit` yields `in-sync | push | conflict`; a stale base version is never auto-merged.
4. **Media variant serving** — `/media/{assetId}/{variant}` → `src/app/media/[assetId]/[variant]/route.ts` → `src/http/assets.ts` `mediaFileResponse` → `src/storage/filesystem-resource-storage.ts` → `data/images/assets/<asset-uuid>/`; variants are written atomically by `src/storage/asset-file-store.ts` (temp file + rename).
5. **Revisions** — publishing forces a snapshot; edit-time snapshots are throttled at 5 minutes and pruned to "every publish snapshot + the latest 20 automatic" (`src/config/article.ts`, `src/domain/revision.ts`); restore runs through `src/app/api/admin/articles/[articleId]/revisions/[revisionId]/restore/route.ts`.
6. **Migration at boot** — `npm run dev`/`start` → `predev`/`prestart` → `tsx scripts/migrate.ts` → `createAppContext()` → `runMigrations(database.db, paths.migrationsDir)` in `src/db/migrate.ts`; `getAppContext()` repeats it, so a long-running server self-migrates. Schema lineage in `drizzle/`: 0000 `health_check` · 0001 `session`, `auth_audit_log` · 0002 `asset`, `asset_variant`, `asset_reference` · 0003 `article*`, `category*`, `tag*` · 0004 adds `article_translation.version` · 0005 `post*` · 0006 adds `article.cover_asset_id`.

## External Dependencies

- **next** — routing, RSC page rendering, route handlers, edge middleware, metadata and sitemap.
- **react** / **react-dom** — server components plus the client islands (editor, theme toggle, Feed paging).
- **drizzle-orm** — typed schema and queries; `src/db/schema.ts` is the single table definition shared by services and drizzle-kit.
- **better-sqlite3** — synchronous SQLite driver in WAL mode; marked `serverExternalPackages` in `next.config.ts`.
- **TipTap v3** — the editor document model; ProseMirror JSON is stored, and readers get HTML through `@tiptap/static-renderer`.
- **sharp** — `thumb` and `display` image variants (WebP), originals preserved; also `serverExternalPackages`.
- **shiki** — code-block highlighting (`src/editor/render/highlighter.ts`).
- **katex** — math rendering (`src/editor/render/math.ts`).
- **argon2** — argon2id verification against `AUTHOR_PASSWORD_HASH` (`src/security/password-hash.ts`, `src/services/auth.ts`).
- **vitest** — the whole test story; service tests run against real in-memory SQLite via `src/test/harness.ts`.

## Known Drift

- `next.config.ts` sets `output: "standalone"`, but `Dockerfile` copies full `node_modules` and `.next` and starts with `npm run start` — the standalone bundle is never used.
- `docs/specs/001-soli-isle.md` lists four layers and omits `src/http/`; `README.md`'s structure block omits `src/middleware.ts`, `src/http/`, `src/editor/nodes`, `src/editor/render` and `src/config/article.ts`. Trust this atlas over those blocks.
- `tsx` scripts (`predev`, `prestart`, `db:migrate`, `seed:demo`, `auth:hash-password`) do not load `.env`; only `scripts/reset-password.ts` parses it explicitly.
