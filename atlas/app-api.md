# app-api

- **Parent**: app
- **Purpose**: Publishes 23 JSON `route.ts` endpoints under `/api` — admin CRUD for Articles, Posts, Assets, Categories and Tags, the public Feed and tombstoned Slug list, and the health probe.
- **Key Files**:
  - `src/app/api/admin/articles/route.ts` (Article list and create)
  - `src/app/api/admin/articles/[articleId]/route.ts` (Article read, update, delete)
  - `src/app/api/admin/articles/[articleId]/publication/route.ts` (Publication State transitions)
  - `src/app/api/admin/articles/[articleId]/revisions/route.ts` (revision capture and list)
  - `src/app/api/admin/posts/route.ts` (Post list and create)
  - `src/app/api/admin/posts/[postId]/images/route.ts` (Post image set)
  - `src/app/api/admin/assets/route.ts` (Asset list and upload)
  - `src/app/api/admin/categories/route.ts` (Category list and create)
  - `src/app/api/admin/tags/route.ts` (Tag list and create)
  - `src/app/api/public/feed/route.ts` (public Feed JSON)
  - `src/app/api/public/gone-slugs/route.ts` (tombstoned Slug list)
  - `src/app/api/health/route.ts` (health probe endpoint)
- **Dependencies**: http, server, services
- **Dependents**: none
- **Exposes**: No importable symbols. Every route is a deliberately thin adapter: it awaits `params`, takes `getAppContext()` as the composition root, and returns the `Response` a `src/http/*` function built — no SQLite, validation or status codes live here. Grouped by resource:
  - **articles** — `src/http/articles`: list/create, read/update/delete, `publication`, `preview`, `revisions` and `revisions/[revisionId]/restore`, `translations` and `translations/[locale]`.
  - **posts** — `src/http/posts`: list/create, read/update/delete, `images`, `publication`, `translations` and `translations/[locale]`.
  - **assets** — `src/http/assets`: list/upload, delete.
  - **categories** and **tags** — `src/http/catalogue`: list/create plus update/delete for each.
  - **public** — `feedResponse` from `src/http/posts`; `gone-slugs` calls `listTombstonedSlugs` from `@/services/reading` inline.
  - **health** — `src/http/health`: `healthResponse(getAppContext().health)`.

## Data Flow
1. Next matches a `route.ts` and calls its exported method — `GET`, `POST`, `PATCH`, `PUT` or `DELETE`.
2. The handler awaits `params` for its path segments (`articleId`, `revisionId`, `locale`, `postId`, `assetId`, `categoryId`, `tagId`).
3. `getAppContext()` supplies the process-wide singletons; the handler passes only the slice it needs (`context.articles`, `context.auth`, `context.assets`, `context.reading`, `context.health`) plus the raw `Request`.
4. The `src/http/*` function authenticates the session, validates the body, calls a service, and builds the `Response` — the route returns it unchanged.

## Internal Structure
- Three namespaces: `/api/admin/*` (session-authenticated reads and mutations), `/api/public/*` (anonymous `feed` and `gone-slugs`), and `/api/health`.
- Depth follows the resource: `[articleId]/` holds read/update/delete, with `publication/`, `preview/`, `revisions/` and `translations/` as siblings beneath it; `[locale]` and `[revisionId]/restore` are the only deeper segments.
- `public/gone-slugs` is the one route that bypasses `src/http`: the Edge middleware cannot read SQLite, so it answers `listTombstonedSlugs(context.reading)` directly and sets `cache-control: no-store`.
- All 23 files declare `export const dynamic = "force-dynamic"` and `export const runtime = "nodejs"`.
