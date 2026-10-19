# app-locale

- **Parent**: app
- **Purpose**: Renders every public reader route under the single `[locale]` dynamic segment — Home, Archive, Category tree, Article, Post Feed with its Tag filter, Search, and Tag listing — plus the Locale-scoped error and not-found boundaries.
- **Key Files**:
  - `src/app/[locale]/layout.tsx` (public root layout and shell)
  - `src/app/[locale]/page.tsx` (Home: hero, grid, paging)
  - `src/app/[locale]/archive/page.tsx` (Archive index by month)
  - `src/app/[locale]/categories/[[...path]]/page.tsx` (Category tree listing)
  - `src/app/[locale]/articles/[slug]/page.tsx` (Article page, TOC, metadata)
  - `src/app/[locale]/feed/page.tsx` (Post Feed with Tag filter)
  - `src/app/[locale]/search/page.tsx` (query form and result grid)
  - `src/app/[locale]/tags/[slug]/page.tsx` (Tag article listing)
  - `src/app/[locale]/not-found.tsx` (in-shell 404 boundary)
  - `src/app/[locale]/error.tsx` (Locale-aware error boundary)
- **Dependencies**: app, components, config, domain, editor-render, http, messages, server, services
- **Dependents**: none
- **Exposes**:
  - URL surface, not symbols: nothing outside the segment imports these modules, so the contract is the addresses `/[locale]`, `/[locale]/archive`, `/[locale]/categories/{path}`, `/[locale]/articles/{slug}`, `/[locale]/feed`, `/[locale]/search`, `/[locale]/tags/{slug}`.
  - Route metadata: each page exports `generateMetadata` (title, description, canonical and language alternates, noindex where applicable) and the segment exports `dynamic = "force-dynamic"` with `runtime = "nodejs"`.
  - Boundaries: `not-found.tsx` and `error.tsx` render `NotFoundView` and `ErrorView` for any route in the segment.

## Data Flow
1. `layout.tsx` awaits `params`, rejects an unknown segment with `notFound()` via `isLocale`, and renders `<html lang>` with the `themeInitScript` and `SiteShell`.
2. The page awaits `params` and, where present, `searchParams`, and repeats the `isLocale` guard before touching data.
3. `getAppContext()` supplies the database-backed services; the page makes one `services/reading` (or `services/articles`, `http/posts`) call scoped by `{ locale }` and any Slug, Tag, Category path or query.
4. The result is mapped to one presentational component — `ReaderHome`, `ArchiveIndex`, `ArticleGrid`, `ArticleView` or `Feed` — together with `messages[locale]` copy and a path builder from `domain/public-paths`.
5. The Article route adds `findReadableArticle` → `resolveBodyImages` → `renderArticleBody` (editor-render) → `buildTableOfContents`, `findArticleNeighbours`, and language links from `domain/article-language`.
6. A thrown page renders `error.tsx` (Locale from `useParams`), a client-side miss renders `not-found.tsx` (Locale from `LOCALE_HEADER`).

## Internal Structure
- `/[locale]` — `listRecentArticles` and `listReaderCategories` read once; `?category` resolves through `resolveCategoryPath` and `?page` through `parsePageNumber`, with no cap in the route.
- `/[locale]/archive` — `listArchiveArticles` plus `listReaderCategories`, folded by `archiveMonths`; `robots: { index: false }`.
- `/[locale]/categories/[[...path]]` — decodes raw segments, redirects an empty path to `buildCategoryIndexPath`, resolves `findReaderCategory` (breadcrumbs, child Categories, grid) and 404s an unknown path.
- `/[locale]/articles/[slug]` — `readArticle` is a `cache()`d one-lookup shared by metadata and render; a `permanently-removed` slug is already answered 410 by middleware and 404s here.
- `/[locale]/feed` — `feedView(context.posts, { locale, tagSlug })` returns a cursor page or `ok: false` for an unknown Tag Slug, which is a 404 rather than the unfiltered Feed; noindex.
- `/[locale]/search` — `searchArticles` over the trimmed `?q`; results highlight `search.terms`; noindex.
- `/[locale]/tags/[slug]` — `findReaderTag` returns the Tag and its Articles, or `notFound()`.

Independent `page.test.ts` / `browse-pages.test.ts` files read the sources as text and assert this wiring rather than rendering, since every page reads the database.
