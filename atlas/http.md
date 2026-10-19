# http

- **Purpose**: Turns a `Request` into a `Response` for every Article, Post, Asset, Category/Tag, session and health endpoint, orchestrating the services layer and never touching SQLite itself.
- **Key Files**:
  - `src/http/articles.ts` (Article CRUD, translations, revisions, preview)
  - `src/http/posts.ts` (Post CRUD, Feed page and cursor)
  - `src/http/assets.ts` (Asset upload, list, delete, media reads)
  - `src/http/catalogue.ts` (Category tree and Tag writes)
  - `src/http/admin-json.ts` (author guard, JSON body readers)
  - `src/http/admin-auth.ts` (login and logout responses)
  - `src/http/gone.ts` (410 document for the middleware)
  - `src/http/health.ts` (health probe response)
  - `src/http/request-cookie.ts` (cookie header parsing)
- **Dependencies**: config, domain, editor-render, messages, services
- **Dependents**: app, app-admin, app-api, app-locale, app-media
- **Exposes**:
  - Article handlers: `listArticlesResponse`, `createArticleResponse`, `getArticleResponse`, `updateArticleResponse`, `deleteArticleResponse`, `addTranslationResponse`, `saveTranslationResponse`, `removeTranslationResponse`, `publicationResponse`, `previewArticleResponse`, `listRevisionsResponse`, `captureRevisionResponse`, `restoreRevisionResponse`.
  - Post and Feed handlers: `listPostsResponse`, `createPostResponse`, `getPostResponse`, `updatePostResponse`, `deletePostResponse`, `addPostTranslationResponse`, `savePostTranslationResponse`, `removePostTranslationResponse`, `setPostImagesResponse`, `publicationResponse`, plus `feedView` (returns a `FeedView` for the Feed page) and `feedResponse` (the `GET /api/public/feed` cursor page).
  - Asset handlers: `listAssetsResponse`, `uploadAssetResponse`, `deleteAssetResponse`, `mediaFileResponse`.
  - Catalogue handlers: `listCategoriesResponse`, `createCategoryResponse`, `updateCategoryResponse`, `deleteCategoryResponse`, `listTagsResponse`, `createTagResponse`, `updateTagResponse`, `deleteTagResponse`.
  - Session and infrastructure: `loginResponse`, `logoutResponse`, `goneResponse`, `healthResponse`.
  - Internal only (not imported outside `src/http`): `admin-json.ts` helpers and `readCookieValue`.

## Data Flow
1. A route in `src/app` calls `getAppContext()` and destructures the one context it needs.
2. It passes the context slice, `context.auth` and the raw `Request` to a `*Response` function.
3. `admin-json.ts` checks the session cookie through `services/auth` and parses the JSON body; a failed check returns `jsonError("unauthorized", 401)`.
4. The handler calls the matching service; a `*MutationFailure` reason is mapped to a status code by that module's own `Record`.
5. Success returns `jsonOk` or `Response.json` with `cache-control: no-store`; Article preview and Feed additionally pass `bodyJson` through `editor-render` before answering.

## Internal Structure
- Two tiers: `admin-json.ts` and `request-cookie.ts` are shared plumbing that every other file imports; the remaining files are one per resource area.
- Every handler is a free function taking its context as the first argument — the module holds no state and no singleton, so App Router route files stay the only wiring point.
- Authorization is repeated per handler through `isAuthorizedAuthor`, not applied by a wrapper, so each route file controls its own exposure.
