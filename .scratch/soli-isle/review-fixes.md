# Review fixes — post-review pass on `dev`

Branch `ticket/review-fixes`, worktree `/tmp/soli-isle-wt/review-fixes`, cut from `dev` tip
`0e0c61e`. One commit per finding, in the priority order the task book gave. No migration, no new
dependency.

| # | finding | commit |
|---|---|---|
| 1 | derived Markdown taken from the client / blanked at the service | `7f8062d` |
| 2 | search highlighted only the summary | `4ae403f` |
| 3 | an archived Article page had no previous/next | `64fd24b` |
| 4 | the site nav's accessible name was "分类" | `bbd03fe` |
| 5 | Article/Post commonality duplicated | `e76687e` |
| 6 | `reading` built by hand in every page | `97ed967` |
| 7 | media address hand-built on the Article page | `502d81f` |
| 8 | `flattenTree` duplicated | `f9c4027` |
| 9 | `coveredLocales` had no production caller | `2c72e5b` |
| 10 | unknown-tag fabrication lived in HTTP | `cb71ef2` |

`git merge dev` after the last commit: no-op (the cut point *is* the tip); all gates re-run after it.

Finding 10 was revised after review: the unknown Tag Slug became a **404** instead of the "filter
nothing" rule this branch first shipped. That revision is the last `fix(posts)` commit on the branch and
§10 explains both choices.

## 1. The derived Markdown column is derived at the service seam

**Was.** `src/http/articles.ts:137` forwarded a client-supplied `bodyMarkdown` on create (its own
docstring claimed the opposite), while every service write path took `bodyMarkdown` as an input and
wrote `input.bodyMarkdown ?? ""`. So any caller that sent only `bodyJson` — the normal case, and
every server-side caller — blanked the column that `searchArticles` LIKEs.

**Now.** `bodyMarkdown` is gone from the input types of `createArticleDraft`,
`addArticleTranslation`, `saveArticleTranslation`, `createPostDraft`, `addPostTranslation`,
`savePostTranslation` (`src/services/articles.ts`, `src/services/posts.ts`). Each derives it from the
JSON it is writing with `deriveMarkdown` (`src/editor/markdown.ts`, already the single deriver, and
already imported by the HTTP layer). A save that carries no `bodyJson` keeps the stored Markdown
instead of re-deriving an empty one. `src/http/articles.ts` and `src/http/posts.ts` no longer import
`deriveMarkdown` at all: `translationInput`/`bodyInput` return `{title?, summary?, bodyJson?}` and
`{bodyJson?}`, and the client's `bodyMarkdown`, if sent, is ignored.

**Tests.** `services/articles.test.ts`: "derives the Markdown column from the ProseMirror JSON it was
given" (was "stores the ProseMirror JSON and the derived Markdown") and a new "re-derives the Markdown
on a body save and keeps it on a title-only save". `services/reading.test.ts`: "finds a body word that
was only ever saved as ProseMirror JSON" — seed → search, i.e. JSON-only still lands in the searchable
column. `http/articles.test.ts`: "derives the Markdown column and ignores a client-supplied one".
`http/posts.test.ts` keeps its existing "derives the Markdown column itself instead of trusting what
the client sent", now with the lie still in the request body.

## 2. Search marks the title and shows the body match

**Was.** `src/components/article-list.tsx` marked `article.summary` only, so the common case — a body
hit — rendered no `<mark>` anywhere.

**Now.** `matchSnippet(text, terms, radius = 60)` in `src/domain/search.ts` returns one line of body
prose cut around the first match (whitespace flattened, cuts moved to a space, `…` on each truncated
end), or `null` when the body holds none of the terms. `searchArticles` puts it on every result as
`snippet` (`ReaderSearchResult extends ReaderArticleCard`), and `ArticleList` marks the title with the
existing `HighlightedText` contract and renders the snippet in place of the summary when there is one
(class `reader-list-summary reader-list-snippet`, so it keeps the summary's styling). Home, Category,
Tag and archive pass no terms, so nothing there changes.

Decision: the snippet *replaces* the summary rather than sitting under it — one prose paragraph per
card, and the paragraph that explains the hit is the one that shows it.

## 3. An archived Article keeps its navigation

**Was.** `findArticleNeighbours` walked `loadCards`, the visibility-filtered list, so an archived
Article got `index === -1` and its page ended with an empty `<nav>`.

**Now.** `readableByUrl` joins `visibleToReader` in `src/services/visibility.ts` (the SQL twin of the
domain `isReadableByUrl`), the card query is factored into `queryCards(ctx, locale, filter)`, and the
chain is built from the URL-readable set. Every list keeps `visibleToReader`.

Test: `services/reading.test.ts` "keeps an archived Article in the chain…" plus "leaves archived
Articles out of the lists that are not a URL chain" so the two predicates cannot be swapped by mistake.

## 4. The site nav's accessible name

`reader.nav.label` added to `zh` ("站点导航") and `en` ("Site navigation"), structurally identical, and
the nav moved out of `src/app/[locale]/layout.tsx` into `src/components/site-nav.tsx` so the attribute
is testable markup rather than an attribute buried in the document layout. Layout keeps the header,
switcher and theme toggle.

Test: `src/components/site-nav.test.tsx` renders it and asserts the label is the nav's own and is not
the Categories label, in both Locales.

## 5. One shared module for Article/Post commonality

`src/services/content.ts` now holds `groupBy`, `localeOrder`, the invalid-body errors (a shared
`InvalidContentBodyError` with `InvalidArticleBodyError` / `InvalidPostBodyError` under it, re-exported
from their services so every import site is unchanged), `finishMutation` (each service calls
`finishMutation("article", () => loadArticle(...))` at its write sites instead of a local `finish`) and
`syncTranslationAssets` (scans each translation's JSON and derived Markdown, plus whatever extra
addresses the work carries — a Post's attached images). Behaviour unchanged; no existing assertion
moved.

Test: `src/services/content.test.ts` pins the new seams (grouping, locale order, the mutation result,
the two error names, and that the sync records references found in the JSON, in the Markdown and in
the extras).

## 6. `reading` in the injected context

`AppContext.reading` (`createReadingContext(database, systemClock)`) replaces eleven hand-built
`createReadingContext(context.database, context.clock)` call sites — `/[locale]` home, search, tags
(two), archive, categories (three), the Article page, `sitemap.ts`, `api/public/gone-slugs` — and the
Article page also stops hand-building `createArticleContext(...)` in favour of `context.articles`.

Test: `server/app-context.test.ts` "hands out the Reader service as part of the injected context".

## 7. Media address from the domain helper

`sharedImagePath` on the Article page uses `buildAssetAddress({variant: "display", format: "webp"})`
and returns `null` for an id the grammar would refuse (an unsafe id previously produced a
`/media/...` URL that could only 404).

## 8. One `flattenTree`

`src/domain/tree.ts` — pure, depth-first, `{ node, depth }[]`. The editor's Category select keeps the
depths it indents by; the Reader Category index takes `.map((entry) => entry.node)`. Test in
`src/domain/tree.test.ts`.

## 9. `coveredLocales` — used, not deleted

Chosen over deletion so no existing assertion had to go: `localeCoverage` is now the covered set
widened to every Site Locale (`new Set(coveredLocales(...))`), so both exports have a caller — the
real one being `articleLanguageLinks` in `src/domain/article-language.ts` via `localeCoverage` — and
"has a version" has one definition.

## 10. The unknown Tag is the service's decision

`resolveFeedTag(ctx, {locale, tagSlug})` in `src/services/posts.ts` answers from the Tag table (new
`findTagViewBySlug` in `src/services/tags.ts`) with `{kind:"all"}` (no Slug given), `{kind:"tag", tag}`
(a real Tag, named in the Reader's Locale) or `{kind:"unknown", slug}`. No adapter invents a name any
more: `feedView` returns `{ok:true, view}` or `{ok:false, reason:"unknown-tag"}`, the Feed page maps the
refusal to `notFound()`, and `GET /api/public/feed` answers `404 {"error":"unknown-tag"}`.

Decision: **a Slug no Tag answers to is a 404.** This reverses the first choice of this pass, which was
"filters nothing": showing the unfiltered Feed under a URL that claims a filter tells the Reader a
filter is applied when it is not (the heading has to be dropped, so it silently looks like the plain
Feed), and it makes a typo'd or deleted Tag URL indistinguishable from the real thing. Every other
unknown resource in this product 404s — an unknown Article Slug, and an unknown Category path — so this
one does too. No tag Slug at all still means the plain Feed, and a known Tag still filters.

The old assertion in `services/posts.test.ts` ("shows only Posts carrying the tapped Tag…") pinned the
fabrication's side effect — `readFeedPage({tagSlug: "no-such-tag"})` → `{posts: [], nextCursor: null}` —
so it genuinely had to move: that empty page existed only because HTTP had invented the Tag. It now
lives as "reports a Slug no Tag answers to as unknown…" (after briefly asserting the rejected
"filters nothing" rule). The known-Tag assertions in the original test are untouched, and the 404 is
covered at both adapters: `http/posts.test.ts` "answers 404 for a Tag Slug that names no Tag…" (the
endpoint) and "refuses the Feed view… which is what the page 404s on" (the value the page turns into
`notFound()`).

## Test changes that were not additions

- `services/articles.test.ts`: the shared `DOC` fixture was not a ProseMirror document — it put `text`
  on a `paragraph` node instead of a `text` child, so its derived Markdown was `""`. It is now a
  well-formed document whose text is `hello`, which is what the (unchanged) assertion
  `{body_json: DOC, body_markdown: "hello"}` states. `bodyMarkdown:` inputs were dropped from the
  service calls; **no assertion was removed** (two of them initially got caught by the same sweep in
  `services/posts.test.ts` and `http/posts.test.ts` and were put back).
- `services/reading.test.ts`: `seedPublished` carried its searchable text in the `markdown` argument;
  it now puts that text in the ProseMirror JSON, because the Markdown column is no longer an input.
  Same tests, same assertions.
- `services/posts.test.ts`: item 10 above — the "unknown slug ⇒ empty page" assertion is now the
  `{kind:"unknown"}` outcome, and the adapter's 404s are new tests.

## Deliberately not changed

Everything on the task book's "do not change" list: `article-editor.tsx` stays one large client
component with its many `useState`s (recorded as debt, not split); `src/domain/article-language.ts`
and the `reader.languages` namespace keep their names; `/api/public/gone-slugs` stays public; the
catalogue delete guards stay protective; `publishTimeFromBody`'s sentinel and
`categoryStatus(reason: string)` are untouched.

Two doc comments were added in place of renames (nothing else in
`src/domain/article-language.ts` changed): the module is about **Locale coverage** — which versions
exist — not machine translation.

## Gates

- `npx tsc --noEmit` — clean.
- `npm run lint` — 0 errors, 1 warning (the pre-existing `eslint.config.mjs` anonymous default export);
  no new warnings.
- `npm test` — **67 files / 691 tests** green (dev tip: 64 files / 665 tests; +26 net, +3 files).
- `npm run build` — `✓ Compiled successfully`; every public route still dynamic, Middleware 44.3 kB
  (unchanged by this pass).

Live smoke on a temp database, `next start` on port 3131 (server and scripts removed afterwards):
`/zh` carries `aria-label="站点导航"` and no `aria-label="分类"`; `/zh/search?q=highlighting` marks the
body match once and renders `.reader-list-snippet`; `?q=last` marks `<mark>Last</mark>` in the title and
renders no snippet; an archived Article answers 200 and ends with `上一篇 Last article`; `/zh/feed?tag=travel`
renders `标签：旅行`, `/zh/feed` renders the plain Feed, while `/zh/feed?tag=nope` answers **404** and
`/api/public/feed?locale=zh&tag=nope` answers **404 `{"error":"unknown-tag"}`**.

## What a second review should look at

- **`reader.nav.label` sits last in the `nav` object** of both message files, so no existing key moved.
  Cosmetic only; swap the order if the file's convention is label-first.
- **`resolveFeedTag` runs twice per accepted Feed page** (once in `feedView`, which decides on the 404,
  and once inside `readFeedPage`). Two reads of the same unique Slug, deliberately: it keeps the rule
  inside the service, keeps `readFeedPage`'s return shape that an existing `toEqual` pins, and leaves
  `readFeedPage` unable to filter by a Tag that does not exist even if a future caller forgets the
  resolution.
- **`SNIPPET_RADIUS = 60`** in `src/domain/search.ts` is a judgement call, not a derived value; it is a
  default parameter, so a caller can pass another.
- **Fix 2 replaces the summary with the snippet** on search results rather than showing both. If the
  editorial summary must always show, that is a two-line change in `ArticleList`.
- **`sharedImagePath` now returns `null` for an unsafe asset id** instead of a `/media/...` URL that
  could only 404, so an Article whose body holds a malformed address loses its OG image rather than
  advertising a broken one.
- **`queryCards` is synchronous** and returns `ReaderArticleCard[]`; it was async-shaped before without
  ever awaiting. Only `findArticleNeighbours` uses the new `readableByUrl` predicate.
- **No live smoke covered the admin editor after the shared `flattenTree`** — its Category tree select
  is only exercised by the build plus the existing tests, so the indentation by depth is worth one
  manual click.
