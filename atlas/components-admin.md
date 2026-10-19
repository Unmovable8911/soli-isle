# components-admin

- **Parent**: components
- **Purpose**: The Author's console UI — the TipTap `ArticleEditor` with its offline-first draft/sync path, `PostComposer`, the asset/Cover pickers, and the Article, Post, Category, Tag and dashboard management tables.
- **Key Files**:
  - `src/components/admin/article-editor.tsx` (TipTap Article editor and save wiring)
  - `src/components/admin/article-sync-engine.ts` (throttled save and retry state machine)
  - `src/components/admin/article-local-store.ts` (IndexedDB store of unsent drafts)
  - `src/components/admin/article-sync-transport.ts` (translation PUT to save outcomes)
  - `src/components/admin/post-composer.tsx` (Post writing screen)
  - `src/components/admin/slash-menu.tsx` (TipTap slash command items)
  - `src/components/admin/cover-field.tsx` (Cover selection with preview)
  - `src/components/admin/asset-library.tsx` (asset uploads and grid)
  - `src/components/admin/article-list.tsx` (console Article listing)
  - `src/components/admin/dashboard-table.tsx` (combined Article and Post table)
  - `src/components/admin/admin-nav.tsx` (console section navigation)
- **Dependencies**: components, config, domain, editor, editor-nodes, messages, services
- **Dependents**: app-admin
- **Exposes**:
  - Author screens: `ArticleEditor` (default), `PostComposer` (default)
  - Lists and managers: `ArticleList`, `PostList`, `CategoryManager`, `TagManager`, `DashboardTable`, `LifecycleActions`
  - Console chrome: `AdminNav`, `AdminPageHead`, `NewWorkButton`
  - Asset and Cover handling: `AssetLibrary`, `AssetPicker`, `CoverField`, `thumbAddress`, `ACCEPTED_IMAGE_TYPES`
  - The sync trio (`article-sync-engine`, `article-local-store`, `article-sync-transport`) is internal to `article-editor` and is not imported by `app-admin`.

## Data Flow
1. A keystroke in `ArticleEditor` produces a `PendingArticleEdit` (title, summary, `bodyJson`, `baseVersion`) and `getArticleDraftStore().save` writes it to IndexedDB database `soli-isle-editor`, store `article-drafts`, keyed `${articleId}:${locale}`.
2. `createArticleSyncEngine` throttles that edit, then calls `transport.save(draft)`; status walks `idle → local → syncing → saved | offline | conflict` and subscribers repaint the toolbar.
3. `createArticleSyncTransport` issues `PUT /api/admin/articles/{articleId}/translations/{locale}` with `baseVersion` and maps the reply to `saved` (200), `stale` (409 `stale-content`) or `unavailable` (anything else).
4. `saved` adopts the new server version and clears the draft; `stale` sets `conflict` and sends nothing — the Author picks a side; `unavailable` retries with backoff `retryBaseMs * 2^(n-1)` capped at `retryMaxMs`.
5. On mount `start(server)` returns `clean`, or `recovered` with the leftover draft, so an unsent edit survives a closed tab.

## Internal Structure
- Editor surface: `article-editor` (1161 lines) drives `slash-menu`, `cover-field`, `asset-picker` and the revision/conflict UI.
- Sync subsystem: `article-sync-engine` (states, throttle, retry) over `article-local-store` (durability) and `article-sync-transport` (HTTP), reconciled through `domain/article-sync`.
- Catalogue management: `category-manager`, `tag-manager`, `asset-library`, `catalogue-notices` share the notice/markup pattern.
- Console chrome: `admin-nav`, `page-head`, `new-work-button`, `confirm-dialog`, `dashboard-table` with `dashboard-actions`.
