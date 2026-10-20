# services

- **Purpose**: Implements Article, Post, Category, Tag, Asset, Author-session and health operations over `src/db` and returns the view types that `src/http` and `src/app` render.
- **Key Files**:
  - `src/services/articles.ts` (Article CRUD, translations, revisions, Slug history)
  - `src/services/posts.ts` (Post CRUD, Feed paging, Post Tags)
  - `src/services/reading.ts` (Reader cards, search, neighbours, tombstones)
  - `src/services/assets.ts` (Asset library, variants, reference tracking)
  - `src/services/categories.ts` (Category tree CRUD and reordering)
  - `src/services/tags.ts` (Tag CRUD and loaded Tag views)
  - `src/services/auth.ts` (Author login, sessions, login throttling)
  - `src/services/asset-image.ts` (sharp upload inspection, WebP variants)
  - `src/services/health.ts` (AvailabilityProbe contract, health report)
  - `src/services/visibility.ts` (shared visibility predicates, no CRUD)
  - `src/services/content.ts` (shared Article/Post helpers, no CRUD)
- **Dependencies**: config, db, domain, editor, security, storage
- **Dependents**: app, app-admin, app-api, app-locale, components, components-admin, db, http, scripts, server, test
- **Exposes**:
  - Context factories binding `DatabaseConnection` + `Clock`: `createArticleContext`, `createPostContext`, `createReadingContext`, `createAssetContext`, `createCategoryContext`, `createTagContext`, `createAuthorAuthContext`.
  - Article: `createArticleDraft`, `getArticle`, `listArticles`, `addArticleTranslation`, `saveArticleTranslation`, `removeArticleTranslation`, `updateArticleMeta`, `publishArticle`, `archiveArticle`, `unarchiveArticle`, `deleteArticlePermanently`, `listRevisions`, `captureAutomaticRevision`, `restoreRevision`, `findReadableArticle`, types `ArticleDetail` / `ArticleSummary` / `ArticleTranslationView` / `ReadableArticle`.
  - Post and Feed: `createPostDraft`, `getPost`, `listPosts`, `addPostTranslation`, `savePostTranslation`, `removePostTranslation`, `setPostDefaultLocale`, `setPostImages`, `setPostTags`, `publishPost`, `archivePost`, `unarchivePost`, `readFeedPage`, `resolveFeedTag`, types `PostDetail` / `PostSummary`.
  - Reader read models: `listRecentArticles`, `listArchiveArticles`, `listReaderCategories`, `findReaderCategory`, `findReaderTag`, `searchArticles`, `findArticleNeighbours`, `listIndexableArticlePaths`, `listTombstonedSlugs`, `resolveBodyImages`, `hasCover`.
  - Assets: `uploadAsset`, `listAssets`, `listOrphanAssets`, `deleteAsset`, `getAssetVariantFile`, `syncAssetReferences`, `AssetUploadError`, type `AssetContext`.
  - Taxonomy: `createCategory`, `listCategoryTree`, `setCategoryName`, `moveCategory`, `reorderCategory`, `deleteCategory`, `createTag`, `listTags`, `setTagName`, `deleteTag`, types `CategoryNode` / `TagView`.
  - Auth and health: `loginAuthor`, `verifyAuthorSession`, `revokeAllAuthorSessions`, `getHealth`, interface `AvailabilityProbe`.

## Data Flow
1. `src/server/app-context.ts` calls each `create*Context` once with the shared `DatabaseConnection`, `systemClock` and `AssetContext`, and hands the result to `src/http`.
2. A write validates the body (`@/domain/rich-text`), derives Markdown (`@/editor/markdown`) and writes Article/Post rows plus their ArticleTranslation / PostTranslation rows through `@/db/schema`.
3. Every write ends in `finishMutation`, which reloads the work; Asset references are rebuilt by `content.ts: syncTranslationAssets` → `syncAssetReferences` from the stored bodies.
4. Reader reads filter through `visibility.ts`: `visibleToReader` (Publication State published + Publish Time reached) for lists, search and Feed; `readableByUrl` (adds archived) only for the Article previous/next chain.
5. Services return view types (`ArticleDetail`, `PostDetail`, `ReaderArticleCard`, `FeedPage`) that `src/http` serialises and `src/app` renders.

## Internal Structure
- CRUD services, one per aggregate: `articles.ts`, `posts.ts`, `categories.ts`, `tags.ts`, `assets.ts`, `auth.ts`.
- `reading.ts` is a read-model only: no writes, no revisions; it composes Category/Tag views for Reader surfaces.
- Shared helpers, not services: `visibility.ts` (two SQL predicates) and `content.ts` (`groupBy`, `localeOrder`, invalid-body errors, `finishMutation`, `syncTranslationAssets`).
- `asset-image.ts` (sharp pipeline) and `health.ts` (probe contract) support `assets.ts` and `@/db/database-health` respectively; both are imported only inside this module or as a type.
- Every `*.test.ts` beside a service builds its fixture through `@/test/harness`.
