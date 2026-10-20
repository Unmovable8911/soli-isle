# components

- **Purpose**: The public reader UI — `SiteShell` chrome wrapping the `ReaderHome`, `ArticleView`, `Feed`, `ArchiveIndex` and `CategoryPills` surfaces, plus the `ArticleCard`/`PostCard`/`Lightbox` primitives those surfaces compose.
- **Key Files**:
  - `src/components/site-shell.tsx` (global chrome: nav, search, footer)
  - `src/components/reader-home.tsx` (hero plus newest-first Article grid)
  - `src/components/article-view.tsx` (one Article: body, versions, zoom)
  - `src/components/feed.tsx` (Feed with append-only cursor paging)
  - `src/components/article-grid.tsx` (responsive Article card grid)
  - `src/components/post-card.tsx` (one Post with fold and images)
  - `src/components/lightbox.tsx` (full-screen image overlay and zoom)
  - `src/components/archive-index.tsx` (month-grouped Article archive)
  - `src/components/error-view.tsx` (error and not-found surfaces)
  - `src/components/locale-switcher.tsx` (Locale dropdown for the shell)
  - `src/components/request-locale.ts` (coerces a URL param to Locale)
  - `src/components/icons.tsx` (inline SVG icon set)
- **Dependencies**: config, domain, messages, services
- **Dependents**: app, app-admin, app-locale, components-admin
- **Exposes**:
  - Page surfaces: `SiteShell`, `ReaderHome`, `ArticleView`, `ArticleGrid`, `Feed`, `FeedHeading`, `ArchiveIndex`, `ReaderPageHead`, `CategoryPills`, `Breadcrumbs`
  - Empty and error states: `EmptyState`, `ErrorView`, `NotFoundView`
  - Shell pieces: `BrandMark` (icons), `MAIN_CONTENT_ID` (skip-link target)
  - Locale helper: `requestLocale`

## Data Flow
1. A page hands `Feed` the first batch of `FeedCardView` posts plus a `nextCursor` and the active `locale`.
2. "Load older" requests `/api/public/feed?locale=…&cursor=…&tag=…`; the first page is never re-fetched and the URL never changes.
3. The response's `posts` are appended to state and `nextCursor` replaces the cursor; `status` surfaces loading and failure through `aria-live`.
4. Each post renders through `PostCard`, whose Cover images open `Lightbox` on click.

## Internal Structure
- Article surface: `reader-home`, `article-view`, `article-body`, `article-card`, `article-grid`, `article-language`, `article-category-filter`.
- Post surface: `feed`, `post-card` (folding plus image strip) and the shared `lightbox`.
- Shell: `site-shell` composes `current-site-nav`, `site-nav`, `site-search`, `locale-switcher`, `theme-toggle`, `site-footer`, `skip-link`.
- Shared pieces: `icons`, `empty-state`, `highlighted-text`, `breadcrumbs`, `home-pagination`, `home-hero`, `category-pills`, `archive-index`.
- `request-locale.ts` is the only non-component file; everything else is a React server or client component.
