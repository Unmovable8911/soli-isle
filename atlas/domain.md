# domain

- **Purpose**: Framework-free, I/O-light logic the whole app shares: 35 single-purpose modules over Locale negotiation, public URL and Slug addressing, Publication State visibility, Feed cursors, rich-text and table-of-contents parsing, and ULID/throttle/session-cookie primitives.
- **Key Files**:
  - `src/domain/public-paths.ts` (public URL build and parse)
  - `src/domain/locale.ts` (Accept-Language negotiation, locale redirects)
  - `src/domain/publication.ts` (Publication State to visibility)
  - `src/domain/translation-coverage.ts` (Locale coverage and fallback pick)
  - `src/domain/article-sync.ts` (editor-vs-server reconciliation verdict)
  - `src/domain/feed-cursor.ts` (Feed keyset cursor and paging)
  - `src/domain/table-of-contents.ts` (body JSON to heading anchors)
  - `src/domain/site-time.ts` (Publish Time site-local conversion)
  - `src/domain/revision.ts` (revision capture and pruning rules)
  - `src/domain/urls.ts` (proxy-aware absolute request URLs)
  - `src/domain/slug.ts` (Slug normalisation and uniqueness)
  - `src/domain/ulid.ts` (ULID generation and predicate)
- **Dependencies**: config
- **Dependents**: app, app-admin, app-locale, components, components-admin, config, db, editor, editor-render, http, scripts, server, services, storage, test
- **Exposes**:
  - Locale and translation: `isLocale`/`negotiateLocale`, `localeFromPathname`/`swapLocalePathname`/`decideLocaleRedirect`, `LOCALE_HEADER`, `coveredLocales`/`localeCoverage`/`selectTranslation`, `pickLocalised`, `articleLanguageLinks`/`alternateLanguageMap`.
  - Addressing: `buildHomePath`/`buildArchivePath`/`buildCategoryPath`/`buildTagPath`/`buildFeedPath`/`buildSearchPath`/`SITEMAP_PATH` and `parseCategoryPath`/`parseTagPath`, `buildArticlePath`/`parseArticlePath`, `normaliseSlug`/`isSafeSlug`/`uniqueSlug`, `categoryPathSegments`/`categoryAncestorPaths`/`isWithinCategoryPath`/`rebaseCategoryPath`, `buildAssetAddress`/`parseAssetAddress`/`extractAssetIds`/`ASSET_VARIANTS`/`ASSET_FORMATS`.
  - Publication: `PUBLICATION_STATES`/`PublicationState`/`publicationVisibility`/`isVisibleToReader`/`isReadableByUrl`/`isIndexable`, `publicationActions`/`PublicationActions`, `shouldCaptureAutomaticRevision`/`selectPrunableRevisions`, `reconcileArticleEdit` and its `"in-sync" | "push" | "conflict"` verdict.
  - Time: `Clock`/`systemClock`/`fixedClock`, `siteLocalToInstant`/`instantToSiteLocal`/`SITE_LOCAL_FORMAT_HINT`, `formatPublishDate`/`formatArchiveMonth`/`archiveMonths`/`INTL_LOCALE_TAG`, `formatRelativeTime`/`formatAbsoluteMinute`.
  - Listing and search: `firstQueryValue`/`resolveCategoryPath`, `paginate`/`parsePageNumber`/`pageCountOf`, `encodeFeedCursor`/`decodeFeedCursor`/`FEED_PAGE_SIZE`/`splitFeedPage`, `FeedCardView`/`FeedView`, `parseSearchTerms`/`escapeLikeTerm`/`highlightSegments`/`matchSnippet`, `flattenTree`, `wrapIndex`.
  - Rich text: `EMPTY_DOCUMENT`/`isRichTextDocument`/`richTextDocumentOrEmpty`, `articleHeadings`/`buildTableOfContents`/`createHeadingAnchors`/`TOC_MIN_HEADINGS`.
  - Infrastructure: `generateUlid`/`ulidTimestamp`/`isUlid`, `ThrottleConfig`/`loginRetryDelay`, `serializeSessionCookie`/`serializeSessionCookieClear`.

## Internal Structure
- Flat layout: 35 source files in `src/domain/`, one concern each, 32 with a colocated `.test.ts`; only ten files import `@/config/site` and only `ulid.ts` touches anything else (`node:crypto`), so the rest close over their siblings.
- **Locale & translation coverage** — `locale.ts`, `translation-coverage.ts`, `localised.ts`, `article-language.ts`.
- **Addressing, URLs & slugs** — `public-paths.ts`, `article-url.ts`, `slug.ts`, `category-path.ts`, `asset-address.ts`, `urls.ts`, `proxy-headers.ts`.
- **Publication & revisions** — `publication.ts`, `publication-actions.ts`, `revision.ts`, `article-sync.ts`.
- **Time** — `clock.ts`, `site-time.ts`, `article-time.ts`, `relative-time.ts`.
- **Listing, pagination & search** — `home-listing.ts`, `pagination.ts`, `feed-cursor.ts`, `feed-view.ts`, `search.ts`, `tree.ts`, `carousel.ts`.
- **Rich text & table of contents** — `rich-text.ts`, `table-of-contents.ts`, `post-fold.ts`, `message-template.ts`.
- **Session, throttle & ULID** — `session-cookie.ts`, `throttle.ts`, `ulid.ts`.
- **Console chrome & asset presentation** — `admin-entry.ts`, `asset-display.ts`.
