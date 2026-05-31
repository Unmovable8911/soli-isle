# API Reference

The soli-isle API is a Fastify/SQLite backend for a multilingual blog. All endpoints are under `/api/`. Public endpoints are read-only. Admin endpoints require a session cookie.

All timestamps are ISO 8601 strings. All IDs are UUIDs.

---

## Getting started

### Start the server

```bash
ADMIN_PASSWORD=your-password node dist/index.js
```

Or in development:

```bash
cd backend
ADMIN_PASSWORD=your-password npx tsx src/index.ts
```

The server listens on port `3000` by default. Override with `PORT=8080`.

### Environment variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ADMIN_PASSWORD` | Yes | — | Admin login password |
| `PORT` | No | `3000` | Server port |
| `HOST` | No | `0.0.0.0` | Bind address |
| `DB_PATH` | No | `./data/soli-isle.db` | SQLite file path |
| `SESSION_SECRET` | No | `change-me-in-production-secret!!` | Session signing key (use a long random string in production) |
| `MEDIA_DIR` | No | `./data/media` | Directory for uploaded files |

### Two kinds of endpoints

**Public endpoints** — read-only, no authentication, support `?lang=` for i18n. Use these in your frontend to display content.

**Admin endpoints** (`/api/admin/*`) — require a session cookie. Use these to create and manage content.

---

## Authentication

Admin access uses session cookies. Log in once to get a cookie, then include it on every admin request.

### Log in

```bash
curl -c cookies.txt -X POST http://localhost:3000/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"password": "your-password"}'
```

```json
{ "ok": true }
```

The `-c cookies.txt` flag saves the session cookie to a file. Use `-b cookies.txt` on subsequent requests to send it back.

In a browser or frontend app, the cookie is set automatically. Include `credentials: "include"` in `fetch` calls:

```js
const res = await fetch("/api/admin/articles", {
  credentials: "include",
});
```

### Check session status

```bash
curl -b cookies.txt http://localhost:3000/api/admin/me
```

```json
{ "authenticated": true }
```

This endpoint doesn't require authentication — use it to check whether a session is still active before making admin calls.

### Log out

```bash
curl -b cookies.txt -X POST http://localhost:3000/api/admin/logout
```

### POST /api/admin/login

**Request body**

```json
{ "password": "your-admin-password" }
```

**Responses**

| Status | Body | When |
|--------|------|------|
| 200 | `{ "ok": true }` | Password correct — sets `Set-Cookie` header |
| 400 | `{ "error": "Password is required" }` | Missing `password` field |
| 401 | `{ "error": "Invalid password" }` | Wrong password |

### POST /api/admin/logout

**Response:** `200 { "ok": true }`

### GET /api/admin/me

Does not require a valid session.

**Response:** `{ "authenticated": true }` or `{ "authenticated": false }`

---

## Internationalization

The API supports multiple languages through a translation model. Every content type has a parallel `*_translations` table. Public endpoints return the translation for the requested language, falling back to the default language.

### Request a language

Add `?lang=` with a language code to any public endpoint:

```
GET /api/articles?lang=zh
GET /api/articles/hello-world?lang=zh
```

If the article has no Chinese translation, the API returns the translation in the default language instead.

If `?lang=` is omitted, the API uses the default language.

### Response shape

Translatable fields are nested under a `translation` key. Non-translatable fields (slugs, timestamps, URLs) are at the top level:

```json
{
  "id": "uuid",
  "slug": "hello-world",
  "published_at": "2026-05-01T00:00:00.000Z",
  "translation": {
    "title": "Hello World",
    "body": "{...tiptap json...}"
  }
}
```

Nested objects like `category` and `tags` each carry their own `translation` object:

```json
{
  "category": { "id": "uuid", "slug": "tech", "translation": { "name": "Technology" } },
  "tags": [{ "id": "uuid", "slug": "rust", "translation": { "name": "Rust" } }]
}
```

### Detect available languages

Fetch the language list before rendering a language switcher:

```js
const langs = await fetch("/api/languages").then((r) => r.json());
// [{ id, code, name, is_default }]

const defaultLang = langs.find((l) => l.is_default === 1);
```

### Add a new language

Adding a language requires no code changes. Use the admin API to insert a new language row and then add `ui_translations` rows for every UI string key:

```bash
# Create the language
curl -b cookies.txt -X POST http://localhost:3000/api/admin/languages \
  -H "Content-Type: application/json" \
  -d '{"code": "fr", "name": "Français"}'

# Seed all UI strings for it (batch upsert)
curl -b cookies.txt -X PUT http://localhost:3000/api/admin/ui-strings \
  -H "Content-Type: application/json" \
  -d '{
    "language_id": "<new-lang-id>",
    "strings": [
      {"key": "nav.home", "value": "Accueil"},
      {"key": "nav.articles", "value": "Articles"}
    ]
  }'
```

Content translations are then added per-item through the admin article/moment/page/resource endpoints.

---

## Pagination

List endpoints that return large result sets use cursor-based pagination on a timestamp field. Every paginated response looks like this:

```json
{
  "data": [...],
  "next_cursor": "base64url-encoded-timestamp-or-null"
}
```

When `next_cursor` is `null`, you've reached the last page.

### Load the next page

Pass `next_cursor` as `?cursor=` on the next request:

```
GET /api/articles?lang=en
→ { data: [...20 items], next_cursor: "MjAyNi0wNS0wMVQwMDowMDowMC4wMDBa" }

GET /api/articles?lang=en&cursor=MjAyNi0wNS0wMVQwMDowMDowMC4wMDBa
→ { data: [...20 items], next_cursor: "..." }

GET /api/articles?lang=en&cursor=...
→ { data: [...5 items], next_cursor: null }
```

### Load all pages at once

```js
async function fetchAll(url) {
  const items = [];
  let cursor = null;

  do {
    const params = new URLSearchParams({ lang: "en" });
    if (cursor) params.set("cursor", cursor);

    const res = await fetch(`${url}?${params}`).then((r) => r.json());
    items.push(...res.data);
    cursor = res.next_cursor;
  } while (cursor);

  return items;
}

const articles = await fetchAll("/api/articles");
```

### Pagination cursor fields

| Endpoint | Cursor field |
|----------|-------------|
| `GET /api/articles` | `published_at` |
| `GET /api/moments` | `published_at` |
| `GET /api/resources` | `created_at` |
| `GET /api/admin/articles` | `created_at` |

Default page size is 20. Max is 50. Override with `?limit=N`.

---

## TipTap body format

Article bodies, moment bodies, and page bodies are stored as TipTap/ProseMirror JSON documents. The API stores and returns them as-is — it doesn't parse or transform them.

A minimal valid body:

```json
{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Hello world"}]}]}
```

An empty document:

```json
{"type":"doc","content":[]}
```

When writing to the admin API, pass the TipTap JSON as a string value for the `body` field:

```json
{
  "language_code": "en",
  "title": "My Post",
  "body": "{\"type\":\"doc\",\"content\":[]}"
}
```

In practice, the admin UI generates this automatically from the TipTap editor. If you're seeding content programmatically, the empty document `{"type":"doc","content":[]}` is a safe placeholder.

---

## Working with media

Uploaded files are stored on disk and served at `/media/:filename`. The filename is a UUID with the original extension preserved.

### Upload a file

```bash
curl -b cookies.txt -X POST http://localhost:3000/api/admin/media \
  -F "file=@/path/to/image.jpg"
```

```json
{ "url": "/media/550e8400-e29b-41d4-a716-446655440000.jpg" }
```

Use the returned `url` as the value for any `cover_image` field when creating or updating content:

```json
{
  "slug": "my-article",
  "cover_image": "/media/550e8400-e29b-41d4-a716-446655440000.jpg",
  "translations": [...]
}
```

You can also embed images inside TipTap content. The TipTap image extension calls `POST /api/admin/media` on upload and inserts the returned URL into the document JSON.

### List uploaded files

```bash
curl -b cookies.txt http://localhost:3000/api/admin/media
```

```json
[
  { "filename": "550e8400.jpg", "url": "/media/550e8400.jpg" }
]
```

### Delete a file

```bash
curl -b cookies.txt -X DELETE \
  http://localhost:3000/api/admin/media/550e8400-e29b-41d4-a716-446655440000.jpg
```

Deleting a file doesn't remove references to it from content — update any articles or resources that use the file before deleting it.

---

## Slug uniqueness

Slugs on articles and pages are **globally unique** — you can't have an article and a page with the same slug. This is enforced via a shared `slugs` lookup table in addition to per-table unique indexes.

The reserved page slugs `articles`, `moments`, `resources`, `api`, `admin`, and `media` can't be used on pages because they'd conflict with the frontend's client-side routing.

---

## Common workflows

### Publish a new article

1. Upload a cover image (optional):

   ```bash
   curl -b cookies.txt -X POST http://localhost:3000/api/admin/media \
     -F "file=@cover.jpg"
   # → { "url": "/media/uuid.jpg" }
   ```

2. Get or create a category:

   ```bash
   curl -b cookies.txt -X POST http://localhost:3000/api/admin/categories \
     -H "Content-Type: application/json" \
     -d '{"slug": "tech", "translations": [{"language_code": "en", "name": "Technology"}]}'
   # → { "id": "cat-uuid", "slug": "tech" }
   ```

3. Create the article:

   ```bash
   curl -b cookies.txt -X POST http://localhost:3000/api/admin/articles \
     -H "Content-Type: application/json" \
     -d '{
       "slug": "intro-to-rust",
       "category_id": "cat-uuid",
       "cover_image": "/media/uuid.jpg",
       "is_draft": 0,
       "published_at": "2026-05-01T00:00:00.000Z",
       "translations": [
         {
           "language_code": "en",
           "title": "Intro to Rust",
           "body": "{\"type\":\"doc\",\"content\":[]}",
           "excerpt": "A beginner guide to Rust"
         }
       ]
     }'
   # → { "id": "art-uuid", "slug": "intro-to-rust" }
   ```

4. Check it's visible on the public endpoint:

   ```bash
   curl http://localhost:3000/api/articles/intro-to-rust?lang=en
   ```

### Add a translation to an existing article

Use `PUT /api/admin/articles/:id` and pass the full `translations` array, including both the existing translation and the new one. The PUT replaces all translations atomically.

```bash
curl -b cookies.txt -X PUT http://localhost:3000/api/admin/articles/art-uuid \
  -H "Content-Type: application/json" \
  -d '{
    "translations": [
      {
        "language_code": "en",
        "title": "Intro to Rust",
        "body": "{\"type\":\"doc\",\"content\":[]}",
        "excerpt": "A beginner guide to Rust"
      },
      {
        "language_code": "zh",
        "title": "Rust 入门",
        "body": "{\"type\":\"doc\",\"content\":[]}",
        "excerpt": "Rust 初学者指南"
      }
    ]
  }'
```

### Publish a draft

```bash
curl -b cookies.txt -X PUT http://localhost:3000/api/admin/articles/art-uuid \
  -H "Content-Type: application/json" \
  -d '{"is_draft": 0, "published_at": "2026-05-01T00:00:00.000Z"}'
```

### Load the home feed

The home feed typically combines recent articles and moments. Make both requests in parallel:

```js
const [articles, moments] = await Promise.all([
  fetch("/api/articles?lang=en&limit=5").then((r) => r.json()),
  fetch("/api/moments?lang=en&limit=10").then((r) => r.json()),
]);
```

### Seed UI strings for a new language

First create the language, then batch-upsert all string keys:

```bash
# Step 1: create the language
curl -b cookies.txt -X POST http://localhost:3000/api/admin/languages \
  -H "Content-Type: application/json" \
  -d '{"code": "ja", "name": "日本語"}'
# → { "id": "lang-uuid", "code": "ja" }

# Step 2: seed strings
curl -b cookies.txt -X PUT http://localhost:3000/api/admin/ui-strings \
  -H "Content-Type: application/json" \
  -d '{
    "language_id": "lang-uuid",
    "strings": [
      {"key": "nav.home",     "value": "ホーム"},
      {"key": "nav.articles", "value": "記事"},
      {"key": "nav.moments",  "value": "つぶやき"}
    ]
  }'
```

The public endpoint at `GET /api/ui-strings?lang=ja` then returns these strings, falling back to the default language for any key not yet translated.

---

## Public endpoints

### GET /api/articles

List published articles. Excludes drafts. Sorted by `published_at` descending.

**Query parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `lang` | string | Language code. Falls back to default language. |
| `category` | string | Filter by category slug. |
| `tag` | string | Filter by tag slug. |
| `cursor` | string | Pagination cursor from a previous response. |
| `limit` | integer | Page size (default: 20, max: 50). |

**Response**

```json
{
  "data": [
    {
      "id": "uuid",
      "slug": "hello-world",
      "cover_image": "/media/uuid.jpg",
      "published_at": "2026-05-01T00:00:00.000Z",
      "created_at": "2026-05-01T00:00:00.000Z",
      "updated_at": "2026-05-01T00:00:00.000Z",
      "title": "Hello World",
      "excerpt": "A short summary"
    }
  ],
  "next_cursor": "base64url-string-or-null"
}
```

`title` and `excerpt` are flattened directly into each list item (not nested under `translation`). `cover_image` and `excerpt` may be `null`.

### GET /api/articles/:slug

Get a single published article by slug. Returns 404 for drafts.

**Query parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `lang` | string | Language code. Falls back to default language. |

**Response**

```json
{
  "id": "uuid",
  "slug": "hello-world",
  "cover_image": "/media/uuid.jpg",
  "published_at": "2026-05-01T00:00:00.000Z",
  "created_at": "2026-05-01T00:00:00.000Z",
  "updated_at": "2026-05-01T00:00:00.000Z",
  "category": {
    "id": "uuid",
    "slug": "tech",
    "translation": { "name": "Technology" }
  },
  "tags": [
    { "id": "uuid", "slug": "rust", "translation": { "name": "Rust" } }
  ],
  "translation": {
    "title": "Hello World",
    "body": "{...tiptap json...}",
    "excerpt": "A short summary"
  }
}
```

`category` is `null` when not set. `tags` is an empty array when none are assigned.

**Responses**

| Status | When |
|--------|------|
| 200 | Article found and published |
| 404 | Slug not found or article is a draft |

### GET /api/moments

List moments. Sorted by `published_at` descending.

**Query parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `lang` | string | Language code. Falls back to default language. |
| `tag` | string | Filter by tag slug. |
| `cursor` | string | Pagination cursor. |
| `limit` | integer | Page size (default: 20, max: 50). |

**Response**

```json
{
  "data": [
    {
      "id": "uuid",
      "published_at": "2026-05-01T00:00:00.000Z",
      "translation": { "body": "{...tiptap json...}" },
      "tags": [
        { "id": "uuid", "slug": "life", "translation": { "name": "Life" } }
      ]
    }
  ],
  "next_cursor": "base64url-string-or-null"
}
```

### GET /api/resources

List resources. Sorted by `created_at` descending.

**Query parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `lang` | string | Language code. Falls back to default language. |
| `category` | string | Filter by category slug. |
| `cursor` | string | Pagination cursor. |
| `limit` | integer | Page size (default: 20, max: 50). |

**Response**

```json
{
  "data": [
    {
      "id": "uuid",
      "url": "https://example.com",
      "cover_image": "/media/uuid.jpg",
      "translation": {
        "title": "Example Resource",
        "description": "A helpful link"
      },
      "category": {
        "id": "uuid",
        "slug": "tools",
        "translation": { "name": "Tools" }
      }
    }
  ],
  "next_cursor": "base64url-string-or-null"
}
```

`cover_image` and `category` may be `null`.

### GET /api/pages

List published pages. Excludes drafts. Sorted by `sort_order` ascending.

**Query parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `lang` | string | Language code. Falls back to default language. |

**Response**

```json
[
  {
    "id": "uuid",
    "slug": "about",
    "published_at": "2026-05-01T00:00:00.000Z",
    "sort_order": 1,
    "translation": { "title": "About" }
  }
]
```

### GET /api/pages/:slug

Get a single published page by slug. Returns 404 for drafts.

**Query parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `lang` | string | Language code. Falls back to default language. |

**Response**

```json
{
  "id": "uuid",
  "slug": "about",
  "published_at": "2026-05-01T00:00:00.000Z",
  "sort_order": 1,
  "translation": {
    "title": "About",
    "body": "{...tiptap json...}"
  }
}
```

### GET /api/categories

List all categories with translated names.

**Query parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `lang` | string | Language code. Falls back to default language. |

**Response**

```json
[{ "id": "uuid", "slug": "tech", "translation": { "name": "Technology" } }]
```

### GET /api/tags

List all tags with translated names.

**Query parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `lang` | string | Language code. Falls back to default language. |

**Response**

```json
[{ "id": "uuid", "slug": "rust", "translation": { "name": "Rust" } }]
```

### GET /api/languages

List all configured languages.

**Response**

```json
[
  { "id": "uuid", "code": "en", "name": "English", "is_default": 1 },
  { "id": "uuid", "code": "zh", "name": "中文", "is_default": 0 }
]
```

### GET /api/ui-strings

Get UI chrome strings for a specific language as a flat key→value map. Keys missing from the requested language fall back to the default language.

**Query parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `lang` | string | **Required.** Language code. |

**Response**

```json
{
  "nav.home": "Home",
  "nav.articles": "Articles",
  "button.read_more": "Read more"
}
```

| Status | When |
|--------|------|
| 200 | Key-value map |
| 400 | `?lang=` is missing |
| 404 | Language code not found |

---

## Admin endpoints

All admin endpoints require a valid session cookie. Without a session, every request returns `401 { "error": "Unauthorized" }`.

### Articles

#### GET /api/admin/articles

List all articles, including drafts. Sorted by `created_at` descending.

**Query parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `cursor` | string | Pagination cursor. |
| `limit` | integer | Page size (default: 20, max: 50). |

**Response**

```json
{
  "data": [
    {
      "id": "uuid",
      "slug": "hello-world",
      "is_draft": 0,
      "published_at": "2026-05-01T00:00:00.000Z",
      "created_at": "2026-05-01T00:00:00.000Z",
      "updated_at": "2026-05-01T00:00:00.000Z"
    }
  ],
  "next_cursor": "base64url-string-or-null"
}
```

#### GET /api/admin/articles/:id

Get a single article with all translations and tag IDs.

**Response**

```json
{
  "id": "uuid",
  "slug": "hello-world",
  "category_id": "uuid-or-null",
  "cover_image": "/media/uuid.jpg",
  "published_at": "2026-05-01T00:00:00.000Z",
  "is_draft": 0,
  "created_at": "2026-05-01T00:00:00.000Z",
  "updated_at": "2026-05-01T00:00:00.000Z",
  "translations": [
    {
      "language_code": "en",
      "title": "Hello World",
      "body": "{...tiptap json...}",
      "excerpt": "A short summary"
    }
  ],
  "tag_ids": ["uuid", "uuid"]
}
```

#### POST /api/admin/articles

Create an article.

**Request body**

```json
{
  "slug": "hello-world",
  "category_id": "uuid",
  "cover_image": "/media/uuid.jpg",
  "is_draft": 1,
  "published_at": "2026-05-01T00:00:00.000Z",
  "translations": [
    {
      "language_code": "en",
      "title": "Hello World",
      "body": "{...tiptap json...}",
      "excerpt": "A short summary"
    }
  ],
  "tag_ids": ["uuid"]
}
```

Required: `slug`, `translations`. Optional: `category_id`, `cover_image`, `is_draft` (default: `1`), `published_at`, `tag_ids`.

Slugs are globally unique across articles and pages.

**Responses**

| Status | Body | When |
|--------|------|------|
| 201 | `{ "id": "uuid", "slug": "hello-world" }` | Created |
| 409 | `{ "error": "Slug already exists" }` | Slug taken |

#### PUT /api/admin/articles/:id

Update an article. All fields are optional — only provided fields are changed.

When `translations` is provided, it **replaces** all existing translations.
When `tag_ids` is provided, it **replaces** all existing tag associations.

**Request body**

```json
{
  "slug": "new-slug",
  "category_id": "uuid",
  "cover_image": "/media/uuid.jpg",
  "is_draft": 0,
  "published_at": "2026-05-01T00:00:00.000Z",
  "translations": [...],
  "tag_ids": ["uuid"]
}
```

**Responses**

| Status | Body | When |
|--------|------|------|
| 200 | `{ "ok": true }` | Updated |
| 404 | `{ "error": "Not found" }` | ID not found |
| 409 | `{ "error": "Slug already exists" }` | New slug is taken |

#### DELETE /api/admin/articles/:id

Delete an article and its slug reservation. Translations and tag associations are removed via cascade delete.

**Responses**

| Status | Body | When |
|--------|------|------|
| 200 | `{ "ok": true }` | Deleted |
| 404 | `{ "error": "Not found" }` | ID not found |

---

### Moments

#### GET /api/admin/moments

List all moments sorted by `published_at` descending.

**Response**

```json
[
  {
    "id": "uuid",
    "published_at": "2026-05-01T00:00:00.000Z",
    "created_at": "2026-05-01T00:00:00.000Z",
    "updated_at": "2026-05-01T00:00:00.000Z"
  }
]
```

#### GET /api/admin/moments/:id

Get a single moment with all translations and tag IDs.

**Response**

```json
{
  "id": "uuid",
  "published_at": "2026-05-01T00:00:00.000Z",
  "created_at": "2026-05-01T00:00:00.000Z",
  "updated_at": "2026-05-01T00:00:00.000Z",
  "translations": [
    { "language_code": "en", "body": "{...tiptap json...}" }
  ],
  "tag_ids": ["uuid"]
}
```

#### POST /api/admin/moments

Create a moment.

**Request body**

```json
{
  "published_at": "2026-05-01T00:00:00.000Z",
  "translations": [
    { "language_code": "en", "body": "{...tiptap json...}" }
  ],
  "tag_ids": ["uuid"]
}
```

Required: `published_at`, `translations`. Optional: `tag_ids`.

**Response:** `201 { "id": "uuid" }`

#### PUT /api/admin/moments/:id

Update a moment. When `translations` is provided, replaces all existing translations. When `tag_ids` is provided, replaces all tag associations.

**Request body**

```json
{
  "published_at": "2026-05-01T00:00:00.000Z",
  "translations": [...],
  "tag_ids": ["uuid"]
}
```

**Response:** `200 { "ok": true }` or `404`

#### DELETE /api/admin/moments/:id

Delete a moment. Translations and tag associations are removed via cascade.

**Response:** `200 { "ok": true }` or `404`

---

### Resources

#### GET /api/admin/resources

List all resources sorted by `created_at` descending.

#### GET /api/admin/resources/:id

Get a single resource with all translations.

**Response**

```json
{
  "id": "uuid",
  "url": "https://example.com",
  "cover_image": "/media/uuid.jpg",
  "category_id": "uuid-or-null",
  "created_at": "2026-05-01T00:00:00.000Z",
  "updated_at": "2026-05-01T00:00:00.000Z",
  "translations": [
    { "language_code": "en", "title": "Example", "description": "A helpful link" }
  ]
}
```

#### POST /api/admin/resources

Create a resource.

**Request body**

```json
{
  "url": "https://example.com",
  "cover_image": "/media/uuid.jpg",
  "category_id": "uuid",
  "translations": [
    { "language_code": "en", "title": "Example", "description": "A helpful link" }
  ]
}
```

Required: `url`, `translations`. Optional: `cover_image`, `category_id`.

**Response:** `201 { "id": "uuid" }`

#### PUT /api/admin/resources/:id

Update a resource. When `translations` is provided, replaces all existing translations.

#### DELETE /api/admin/resources/:id

Delete a resource. Translations are removed via cascade.

---

### Pages

#### GET /api/admin/pages

List all pages (including drafts) sorted by `sort_order`.

#### GET /api/admin/pages/:id

Get a single page with all translations.

**Response**

```json
{
  "id": "uuid",
  "slug": "about",
  "published_at": "2026-05-01T00:00:00.000Z",
  "is_draft": 0,
  "sort_order": 1,
  "created_at": "2026-05-01T00:00:00.000Z",
  "updated_at": "2026-05-01T00:00:00.000Z",
  "translations": [
    { "language_code": "en", "title": "About", "body": "{...tiptap json...}" }
  ]
}
```

#### POST /api/admin/pages

Create a page.

**Request body**

```json
{
  "slug": "about",
  "is_draft": 1,
  "sort_order": 1,
  "published_at": "2026-05-01T00:00:00.000Z",
  "translations": [
    { "language_code": "en", "title": "About", "body": "{...tiptap json...}" }
  ]
}
```

Required: `slug`, `translations`. Optional: `is_draft` (default: `1`), `sort_order` (default: `0`), `published_at`.

Page slugs are globally unique across articles and pages. These slugs are reserved and can't be used: `articles`, `moments`, `resources`, `api`, `admin`, `media`.

**Responses**

| Status | Body | When |
|--------|------|------|
| 201 | `{ "id": "uuid", "slug": "about" }` | Created |
| 400 | `{ "error": "Slug '...' is reserved" }` | Reserved slug |
| 409 | `{ "error": "Slug already exists" }` | Slug taken |

#### PUT /api/admin/pages/:id

Update a page. When `translations` is provided, replaces all existing translations.

**Responses**

| Status | When |
|--------|------|
| 200 | Updated |
| 400 | New slug is reserved |
| 404 | ID not found |
| 409 | New slug is taken |

#### DELETE /api/admin/pages/:id

Delete a page and its slug reservation. Translations are removed via cascade.

---

### Categories

#### GET /api/admin/categories

List all categories with their translations.

**Response**

```json
[
  {
    "id": "uuid",
    "slug": "tech",
    "created_at": "2026-05-01T00:00:00.000Z",
    "updated_at": "2026-05-01T00:00:00.000Z",
    "translations": [
      { "language_code": "en", "name": "Technology" }
    ]
  }
]
```

#### POST /api/admin/categories

Create a category.

**Request body**

```json
{
  "slug": "tech",
  "translations": [{ "language_code": "en", "name": "Technology" }]
}
```

**Response:** `201 { "id": "uuid", "slug": "tech" }` or `409` on duplicate slug.

#### PUT /api/admin/categories/:id

Update a category. When `translations` is provided, replaces all existing translations.

#### DELETE /api/admin/categories/:id

Delete a category.

---

### Tags

Same structure as categories. Routes are under `/api/admin/tags`.

#### POST /api/admin/tags

**Request body**

```json
{
  "slug": "rust",
  "translations": [{ "language_code": "en", "name": "Rust" }]
}
```

**Response:** `201 { "id": "uuid", "slug": "rust" }` or `409` on duplicate slug.

---

### Languages

#### GET /api/admin/languages

List all languages.

**Response**

```json
[
  { "id": "uuid", "code": "en", "name": "English", "is_default": 1 },
  { "id": "uuid", "code": "zh", "name": "中文", "is_default": 0 }
]
```

#### POST /api/admin/languages

Create a language.

**Request body**

```json
{ "code": "fr", "name": "Français", "is_default": 0 }
```

Required: `code`, `name`. Optional: `is_default` (default: `0`).

Setting `is_default: 1` automatically clears the flag on all other languages — there can only be one default.

**Responses**

| Status | Body | When |
|--------|------|------|
| 201 | `{ "id": "uuid", "code": "fr" }` | Created |
| 409 | `{ "error": "Language code already exists" }` | Duplicate code |

#### PUT /api/admin/languages/:id

Update a language. Setting `is_default: 1` clears the flag on all other languages.

**Request body**

```json
{ "code": "fr", "name": "Français", "is_default": 1 }
```

#### DELETE /api/admin/languages/:id

Delete a language.

**Responses**

| Status | When |
|--------|------|
| 200 | Deleted |
| 400 | Language is the current default — assign a new default first |
| 404 | ID not found |

---

### UI strings

UI strings power front-end chrome: nav labels, button text, headings, dates. They're stored per language and keyed by a dot-separated string like `nav.home` or `button.read_more`.

The frontend fetches `GET /api/ui-strings?lang=xx` once on load and stores the result in a React context. All chrome labels resolve from that context. Adding a new language or updating strings takes effect immediately with no redeploy.

#### GET /api/admin/ui-strings

List all UI strings for a language.

**Query parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `language_id` | string | **Required.** Language UUID. |

**Response**

```json
[
  { "id": "uuid", "key": "nav.home", "language_id": "uuid", "value": "Home" }
]
```

Returns `400` if `language_id` is missing.

#### POST /api/admin/ui-strings

Create a single UI string.

**Request body**

```json
{ "key": "nav.home", "language_id": "uuid", "value": "Home" }
```

**Response:** `201 { "id": "uuid" }` or `409` if the key already exists for that language.

#### PUT /api/admin/ui-strings

Batch upsert UI strings. Updates existing keys, inserts missing ones. Use this when importing translations for a new language or syncing a full string set.

**Request body**

```json
{
  "language_id": "uuid",
  "strings": [
    { "key": "nav.home", "value": "Home" },
    { "key": "nav.articles", "value": "Articles" }
  ]
}
```

**Response:** `200 { "ok": true }`

#### PUT /api/admin/ui-strings/:id

Update a single UI string's value.

**Request body**

```json
{ "value": "Home (updated)" }
```

**Response:** `200 { "ok": true }` or `404`

#### DELETE /api/admin/ui-strings/:id

Delete a UI string.

**Response:** `200 { "ok": true }` or `404`

---

### Media

Media files are stored on disk and served statically at `/media/:filename`.

#### POST /api/admin/media

Upload a file. Send as `multipart/form-data`. Max size is 10 MB. The original file extension is preserved; the filename is replaced with a UUID.

```bash
curl -b cookies.txt -X POST http://localhost:3000/api/admin/media \
  -F "file=@image.jpg"
```

**Response**

```json
{ "url": "/media/550e8400-e29b-41d4-a716-446655440000.jpg" }
```

**Responses**

| Status | When |
|--------|------|
| 200 | File uploaded |
| 400 | No file in the request |

#### GET /api/admin/media

List all uploaded files.

**Response**

```json
[{ "filename": "uuid.jpg", "url": "/media/uuid.jpg" }]
```

#### DELETE /api/admin/media/:filename

Delete a file.

**Responses**

| Status | When |
|--------|------|
| 200 | `{ "ok": true }` |
| 400 | Filename contains `/` or `..` |
| 404 | File not found |

---

## Health check

### GET /api/health

No authentication required.

```json
{ "status": "ok" }
```

---

## Error format

All errors use the same shape:

```json
{ "error": "Human-readable message" }
```

Common status codes:

| Status | Meaning |
|--------|---------|
| 400 | Bad request — missing or invalid input |
| 401 | Unauthenticated — no valid session |
| 404 | Resource not found |
| 409 | Conflict — duplicate slug or language code |
