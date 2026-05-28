# Personal Blog — Design Spec

## Overview

Personal blog website with articles, short-form moments, resource sharing, and standalone pages. Single admin user manages all content through a custom admin interface. Public frontend is a client-side SPA consuming a Fastify API.

## Tech Stack

| Layer | Choice |
|-------|--------|
| Frontend | Vite + React + React Router (SPA) |
| Backend | Fastify (Node.js) |
| Database | SQLite |
| ORM | Drizzle |
| Rich text | TipTap (ProseMirror-based) |
| Auth | Fastify session cookie; admin password via env var |
| Deployment | Single Docker container behind existing OpenResty reverse proxy |

## Content Model

Four content types, each with a parallel translation model for i18n. All models use UUID primary keys.

### Article

| Field | Type | Notes |
|-------|------|-------|
| slug | text | globally unique across Articles + Pages |
| category_id | FK → Category | |
| cover_image | text | file path, optional |
| tags | M2M → Tag | junction table |
| published_at | text (ISO 8601) | |
| is_draft | integer (bool) | default 1 |
| created_at | text (ISO 8601) | auto |
| updated_at | text (ISO 8601) | auto |

Translatable fields (title, body, excerpt) live in `article_translations`.

### Moment

| Field | Type | Notes |
|-------|------|-------|
| tags | M2M → Tag | junction table |
| published_at | text (ISO 8601) | |
| created_at | text (ISO 8601) | auto |
| updated_at | text (ISO 8601) | auto |

No title, no slug, no draft state. Moments are feed-only — they appear in the home page feed and /moments listing. No individual detail page. Translatable field (body) lives in `moment_translations`.

### Resource

| Field | Type | Notes |
|-------|------|-------|
| url | text | external link |
| cover_image | text | file path, optional |
| category_id | FK → Category | |
| created_at | text (ISO 8601) | auto |
| updated_at | text (ISO 8601) | auto |

No published_at, no tags, no draft state. Resources are always visible once created. Translatable fields (title, description) live in `resource_translations`.

### Page

| Field | Type | Notes |
|-------|------|-------|
| slug | text | globally unique across Articles + Pages |
| published_at | text (ISO 8601) | |
| is_draft | integer (bool) | default 1 |
| sort_order | integer | controls nav ordering |
| created_at | text (ISO 8601) | auto |
| updated_at | text (ISO 8601) | auto |

No category, no tags. Pages are standalone (About, Contact, etc.) and fetched by slug. Page slugs are validated to reject reserved route names (articles, moments, resources, api, admin, media). Translatable fields (title, body) live in `page_translations`.

### Taxonomy

- **Category**: slug. FK on Article and Resource. Name is translatable via `category_translations`.
- **Tag**: slug. M2M on Article and Moment (junction tables). Name is translatable via `tag_translations`.
- **Language**: code, name, is_default (integer bool). Used by all translation models.
- **UITranslation**: key, language_id (FK → Language), value. Stores UI chrome strings (nav labels, buttons, headings). Adding a new language means inserting `UITranslation` rows for each key — no code changes, no redeploy.

### Slug Uniqueness

Slugs on Article and Page are globally unique — enforced at the application level via a shared lookup table or a unique index covering both tables.

### Multilingual Support (i18n)

Translation model approach. Each content type gets a parallel translation table. A **Language** table defines available languages — adding a new language means inserting a row in the admin, no code changes needed.

**Language model:** `code` (e.g., "en", "zh"), `name` (e.g., "English", "中文"), `is_default` (integer bool — fallback when no translation exists for the requested language).

**Translatable fields per type:**

| Content type | Translatable fields | Translation table |
|-------------|-------------------|-------------------|
| Article | title, body, excerpt | article_translations |
| Moment | body | moment_translations |
| Resource | title, description | resource_translations |
| Page | title, body | page_translations |
| Category | name | category_translations |
| Tag | name | tag_translations |

Non-translatable fields (slug, cover_image, published_at, is_draft, url, sort_order, timestamps) stay on the parent table.

**Admin UX:** Translation tabs in the editor — switch language to edit each translation inline on the same page.

**API behavior:**
- `?lang=zh` query param on list/detail endpoints — returns the requested translation if available
- Falls back to the default language when no translation exists for the requested language
- `Accept-Language` header also supported as an alternative

**Client-side behavior:**
- On first visit, `navigator.language` is matched against available languages. If supported, content loads in that language. Otherwise falls back to the default language.
- Manual language switch persists the choice in `localStorage`. Subsequent visits use the stored preference.
- Switching languages triggers a refetch via `?lang=` and re-renders in place.

## Architecture

### Container Stack

Single Docker container:

- **app** — Fastify serving API routes, admin routes, and the Vite-built React SPA as static files.
- **SQLite** — single file, mounted as a volume for persistence.

The existing OpenResty instance on the server handles TLS termination and reverse proxying to the container port.

### Request Flow

```
Browser → OpenResty :443
  ├── /api/*    → Fastify
  ├── /admin/*  → Fastify → React SPA shell → client-side routing
  ├── /media/*  → Fastify serves uploaded files
  └── /*        → Fastify serves React SPA static build
```

### Data Flow

- **Runtime:** The SPA loads → React Router picks up the URL → TanStack Query fetches JSON from `/api/*` → React renders the page. All content is fetched client-side on every visit.
- **Content updates:** No build step. New/updated content appears immediately because the SPA fetches live JSON from the API.
- **Admin:** Custom React routes behind a login gate. Admin API calls use the session cookie set at login.
- **No client-side source code on admin routes.** Admin pages are part of the same SPA bundle but gated behind client-side auth checks. API-level authorization is enforced on all `/api/admin/*` routes.

## API Design

All public endpoints under `/api/`. Read-only. Admin endpoints under `/api/admin/`. Write operations through admin routes only.

### Public Endpoints

| Endpoint | Behavior |
|----------|----------|
| `/api/articles/` | list + detail by slug, filter by category, tag, date |
| `/api/moments/` | list + detail, filter by tag, date |
| `/api/resources/` | list + detail, filter by category |
| `/api/pages/` | list published, detail by slug |
| `/api/categories/` | list all |
| `/api/tags/` | list all |
| `/api/languages/` | list all |
| `/api/ui-strings/` | returns key-value map for requested `?lang=` |

Filtering via query parameters. Cursor-based pagination on list endpoints. Draft content excluded from public responses. `/api/categories/` and `/api/tags/` support `?lang=` for translated names. `/api/ui-strings/` returns a flat `{ "key": "value" }` map of all UI chrome strings for the requested language, falling back to the default language for missing keys.

### Admin Endpoints

| Endpoint | Behavior |
|----------|----------|
| `/api/admin/login` | POST — validates password, sets session |
| `/api/admin/logout` | POST — destroys session |
| `/api/admin/articles/` | CRUD |
| `/api/admin/moments/` | CRUD |
| `/api/admin/resources/` | CRUD |
| `/api/admin/pages/` | CRUD |
| `/api/admin/categories/` | CRUD |
| `/api/admin/tags/` | CRUD |
| `/api/admin/languages/` | CRUD |
| `/api/admin/media/` | upload/list/delete images |
| `/api/admin/ui-strings/` | CRUD — manage UI chrome translations |

All `/api/admin/*` routes require a valid session. Returns 401 if unauthenticated.

### Translation Response Format

Parent objects hold non-translatable fields. Translated fields are returned in a nested `translation` object matching the requested `?lang=` with fallback to the default language:

```json
{
  "id": "...",
  "slug": "hello-world",
  "published_at": "2026-05-01T00:00:00Z",
  "category": { "id": "...", "slug": "tech", "translation": { "name": "技术" } },
  "tags": [{ "id": "...", "slug": "rust", "translation": { "name": "Rust" } }],
  "translation": { "title": "你好世界", "body": "..." }
}
```

## Frontend

### Routes (client-side)

| Route | Content | API source |
|-------|---------|------------|
| `/` | Home feed — recent articles + moments | `/api/articles/` + `/api/moments/` |
| `/articles` | Article listing (paginated) | `/api/articles/` |
| `/articles/[slug]` | Single article | `/api/articles/?slug=` |
| `/moments` | All moments (paginated) | `/api/moments/` |
| `/resources` | Resource directory | `/api/resources/` |
| `/[slug]` | Standalone page | `/api/pages/?slug=` |
| `/admin/*` | Admin interface | `/api/admin/*` |

Category and tag filtering via query params on listing pages (e.g., `/articles?category=tech`, `/moments?tag=life`). No dedicated category/tag pages.

### Components

- `ArticleCard`, `MomentCard`, `ResourceCard` — per-type listing cards
- `RichContent` — renders TipTap JSON as HTML (read-only mode, shares extension config with admin editor)
- `FilterBar` — fetches category/tag list, renders clickable filter pills
- `InfiniteScroll` — scroll-to-load pagination on listing pages (TanStack Query `useInfiniteQuery`)
- `LanguageSwitcher` — toggles `?lang=`, persists choice to `localStorage`, supports auto-detect from `navigator.language`
- `ProtectedRoute` — wraps admin routes, checks auth state, redirects to login

### Rendering Strategy

- Vite builds the React SPA to static files (`index.html` + JS/CSS bundles)
- Fastify serves these files under `/*`
- All page rendering happens client-side: shell loads → React Router matches URL → TanStack Query fetches data → React renders
- TanStack Query caches responses so navigation between pages is instant (no refetch on back/forward)
- No SSR, no ISR, no static generation. No build step tied to content changes.

### Language Auto-Detection

On first visit:
1. Read `navigator.language`
2. Match against `/api/languages/` response
3. If supported, set `?lang=` accordingly
4. If not supported, use the default language
5. On manual switch, persist to `localStorage`
6. Subsequent visits: check `localStorage` first, fall back to `navigator.language`

### UI Chrome Translations

UI strings (nav labels, buttons, headings, "Published on", "Read more", etc.) are stored in the `ui_translations` database table and exposed at `/api/ui-strings/?lang=`. The SPA fetches UI strings once on load (and on language switch), stores them in a React context, and resolves all chrome labels from that context.

Adding a new language to the site requires no code changes and no redeploy — insert a `Language` row plus `UITranslation` rows for each key via the admin. The SPA picks them up automatically.

## Authentication

- Single admin user. Password stored as env var (`ADMIN_PASSWORD`), hashed with bcrypt at startup.
- Login: POST `/api/admin/login` with password. Fastify sets a session cookie.
- Session management via `@fastify/cookie` + `@fastify/session`.
- Admin API routes check the session on every request. Returns 401 if invalid.
- Admin frontend routes wrapped in `ProtectedRoute` — redirects to login page if not authenticated.
- No registration flow, no password reset, no multi-user.

## Rich Text Editor

- **Editor:** TipTap integrated as a React component in the admin
- **Storage:** JSON column in SQLite (ProseMirror document model)
- **Rendering:** `RichContent` React component renders JSON via TipTap's read-only mode (shared between public and admin)
- **Toolbar:** Bold, italic, headings, links, lists, blockquotes, images
- **Image upload:** TipTap's image extension is configured with an upload callback that POSTs to `/api/admin/media/`. On success the endpoint returns the file URL, which TipTap inserts into the document. On failure the image node is removed and an error toast is shown.
- **Fields using TipTap:** article body, moment body, page body

## Testing Strategy

| Layer | Scope | Tool |
|-------|-------|------|
| Backend routes | Public read-only, filtering, pagination, admin auth | Vitest + Fastify inject |
| Database | Schema constraints, slug uniqueness, draft filtering | Vitest |
| Frontend | Component smoke tests | Vitest + React Testing Library |

## Future Considerations

- Movies/TV and Books sharing (cover, review, and link, not actual media files)
- In-page media player with autoplay
- Mobile admin app for posting moments
- AI-assisted editing and translation (content drafting, grammar, auto-translate between languages)
- Full-text search (SQLite FTS5)

## Out of Scope

- Comments
- User registration
- Multi-user support
- CDN / horizontal scaling
- RSS/Atom feeds
