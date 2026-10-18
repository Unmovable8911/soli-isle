# 11: Admin management & dashboard

**What to build:** The Author runs the whole site from the admin: a dashboard listing every Article and Post with its Publication State and Publish Time, full Category tree management (hierarchy, ordering, unique slug paths, display names per Locale), and Tag management (slug plus display name per Locale). The admin follows the Author's chosen interface language, and its main operations are keyboard-operable.

**Blocked by:** 05 — First published Article; 08 — Post feed; 10 — Content translations & SEO language wiring

**Status:** ready-for-agent

- [x] The dashboard lists all Articles and Posts with their Publication State and Publish Time, distinguishing draft, published, scheduled, and archived, and offers the lifecycle actions from one place.
- [x] Category management supports the full tree: parent/child structure, ordering, unique slug paths within the tree, and a display name per Locale.
- [x] Tag management supports slug and a display name per Locale.
- [x] The admin interface follows the Author's chosen interface language.
- [x] The admin's main operations are reachable by keyboard alone.

## Comments

No migration (`0006` was not needed — `category.position`, `category.path` and both translation tables already exist), no new dependency, no new styling system. The admin gained two pages (`/admin/categories`, `/admin/tags`), a rewritten `/admin`, one nav in the console shell, two write routes per catalogue and four service functions per kind.

**The dashboard derives nothing.** `/admin` renders `listArticles` and `listPosts` on the server; each row's label is `labels.state[work.visibility]` and the same `visibility` is handed to the row's action component. `visibility` is what `publicationVisibility` in `src/domain/publication.ts` says — "scheduled" is a *published* work whose Publish Time has not arrived, and a draft reports `draft` whatever Publish Time it carries. A live smoke check confirmed the served markup says `publication-state-scheduled` for a 2027 Publish Time and `publication-state-archived` after archiving. `src/components/admin/article-list.tsx` had the older bug (`labels.state[article.publicationState]`, so a scheduled Article read "已发布"); it now uses the derived label too — a one-line change inside 05's component, made because the dashboard and the list must not disagree.

- **Which actions a row offers is a pure function**: `src/domain/publication-actions.ts` → `publicationActions(visibility)` → `{publishNow, schedule, archive, unarchive}`. The flags mirror the service preconditions exactly (`archiveArticle` refuses anything whose stored state is not `published` ⇔ visible **or** scheduled; `unarchiveArticle` refuses anything not archived), so a row can never offer a call the service would reject. Publishing a work that is already visible is not offered — it would only rewrite the Publish Time of something Readers can already see. Permanent delete is always offered and always goes through the confirmation dialog.
- **Rendered, not fetched**: the tables arrive as props from the page (`DashboardTable`), and only the row actions are client code. A dashboard with no rows says so instead of rendering an empty table.

**Category management** (`/admin/categories`) shows the tree as nested `<ul>`s, never a flat list, with each level's positions rewritten as `0..n-1`. The service surface, all in `src/services/categories.ts`:

| function | outcome |
|---|---|
| `setCategoryName({categoryId, locale, name})` | the piece ticket 10 deferred: adds or replaces one Locale's display name on an existing Category, leaving the Slug path alone |
| `moveCategory({categoryId, parentId})` | re-parents and rebuilds every path in the subtree (`rebaseCategoryPath` in `src/domain/category-path.ts`), appends at the end of the new siblings; refuses `cyclic-move`, `unknown-parent`, `duplicate-slug` |
| `reorderCategory({categoryId, direction})` | swaps with the adjacent sibling and rewrites that level's positions; refuses `no-sibling` at either end |
| `deleteCategory({categoryId, moveArticlesTo?})` | see the rule below |

`createCategory` still refuses a duplicate Slug path rather than merging names (unlike `createTag`): a duplicate Category is a mistake, a retyped Tag is a topic. Its root-position query was filtering *every* row instead of the roots, which would have let a new top-level Category sort after a nested one; fixed here.

**The deletion rules, stated plainly, and both tested:**

- **A Category is deleted only when nothing points at it.** Child Categories first: if any remain the delete is refused with `has-children` and the count (the `parent_id` foreign key would refuse it anyway, so the service says why before the database does). Articles next: if the Category is in use, the delete is refused with `in-use` and the count unless the same request names where those Articles go (`?moveArticlesTo=<categoryId>`), in which case they are moved and the Category is deleted in one transaction. There is deliberately **no** "just uncategorise them" path: the schema's `ON DELETE SET NULL` would silently empty every Article's Category, so the Author either names a destination or is told the count. A destination that does not exist, or is the Category being deleted, is refused (`unknown-destination`).
- **A Tag is deleted only when nothing is filed under it.** `deleteTag` counts `article_tag` and `post_tag` rows and refuses with `in-use`, `articleCount` and `postCount`. The join rows cascade on delete, so allowing it would quietly strip the topic from work the Author never looked at; the refusal tells them how much to untag first. `setTagName` is the matching per-Locale rename.

**Uniqueness is a constraint, not a UI check.** `category.path` carries `uniqueIndex("category_path_idx")`; a test asserts that index exists *and* that a raw `INSERT` of a duplicate path is rejected by SQLite, and another asserts a move that would collide with an existing sibling path is refused with `duplicate-slug` before anything moves.

**Two new write endpoints per kind**, each verifying the session itself (`src/http/catalogue.ts`, `src/app/api/admin/{categories/[categoryId],tags/[tagId]}/route.ts`): `PATCH /api/admin/categories/<id>` with `{action: "rename"|"move"|"reorder"}` and `DELETE ...?moveArticlesTo=`; `PATCH /api/admin/tags/<id>` with `{action: "rename"}` and `DELETE`. Errors stay `{error:"<kebab-code>"}`; the two refusals that carry information answer `409 {error:"in-use", articleCount[, postCount]}` / `409 {error:"has-children", childCount}`, and the manager turns that body into the sentence the Author sees (`src/components/admin/catalogue-notices.ts`, pure and tested).

**The admin's interface language**: every new string is in `src/messages/{zh,en}.json` — `admin.dashboard` (including `state.{visible,scheduled,draft,archived}`), `admin.categories`, `admin.tags`, and `admin.shell.nav{Label}`. `admin.home` is gone: its "content management will arrive later" hint was the placeholder this ticket replaced. `zh` was written first and `en` is structurally identical (every key path compared; `tsc` enforces it through `Messages = typeof zh`). Live check: `Accept-Language: en` served `Admin console` / `Archived` / `Publish now` / `Parent Category` / `Move up`, `zh-CN` served `分类` / `标签`.

**Keyboard checklist** (every row is a native control, so Tab reaches it and Enter/Space activates it; the ring is ticket 12's global `:focus-visible` — no rule in the new CSS removes an outline):

| operation | control |
|---|---|
| reach the console areas | `nav` in the console header, six real links |
| move between Articles/Posts and their editors | links in the table's first column |
| publish now / archive / unarchive / schedule / delete permanently | `<button>`s per row; schedule is a `<input type="datetime-local">` (named by an `aria-label` from the message JSON) plus its button |
| confirm a delete | two-step dialog: `role="dialog" aria-modal="true"`, opens with focus on the dialog, Tab is trapped, Esc cancels, focus returns to the button that opened it (the asset picker's pattern) |
| create a Category | a form: name, optional Slug, parent `<select>` (indented paths), submit |
| rename a Category per Locale | one small form per Site Locale behind a `<details>` disclosure |
| move / reorder a Category | parent `<select>` + move button; **move up** / **move down** buttons (no drag handles, nothing hover-only) |
| delete a Category | per-node button → confirmation dialog carrying the destination `<select>` for its Articles |
| create / rename / delete a Tag | one form and one button per row, two name forms (one per Locale) |
| switch interface language | the existing `soli-locale` cookie / `Accept-Language` resolution in every admin page and layout |

`forbiddenParents` keeps the move `<select>` from offering the Category itself or one of its descendants; the service refuses that move with `cyclic-move`, so the UI is honest and the API is safe.

**Validation**: `npx tsc --noEmit` clean; `npm run lint` 0 errors (the one pre-existing `eslint.config.mjs` warning, no new warnings); `npm test` **64 files / 665 tests** green — **69 new** across 6 new files and 3 extended ones (`domain/publication-actions` 5, `domain/message-template` 4, `domain/category-path` +2, `services/categories` +18, `services/tags` +6, `http/catalogue` 12, `components/admin/dashboard-table` 7, `components/admin/catalogue-markup` 10, `components/admin/catalogue-notices` 5; the dev tip this branch was cut from measured 58 files / 596 tests); `npm run build` succeeds, adding `ƒ /admin` (1.66 kB), `ƒ /admin/categories` (3.06 kB), `ƒ /admin/tags` (2.35 kB), `ƒ /api/admin/categories/[categoryId]` and `ƒ /api/admin/tags/[tagId]`, and changing no public route. `git merge dev` was a no-op (the dev tip `2e2b241` was the cut point) and every gate was re-run after it.

A live `next start` on port 3111 (fresh temp database, migrations `0000`–`0005`) covered the chain: login 303 → `/admin` 200 → create Article → schedule it at `2027-03-01T09:00` (stored `2027-03-01T01:00:00.000Z`, the site timezone) → the served dashboard markup carries exactly one `publication-state-scheduled` and no visible label → create `手记` → child `tools` (`手记/tools`) → `PATCH rename` adds `en: Tools` → `move parentId:null` puts it at the root → `reorder up` swaps positions 0/1 → a move into itself is `409 cyclic-move` → filing an Article under `tools` makes its delete `409 {"error":"in-use","articleCount":1}` → the same delete with `?moveArticlesTo=<essays>` answers `{"movedArticles":1}` and the Article then reports `category.path = "essays"` → `/admin/categories` 200 with two name forms per Category and the nested paths → archive → `publication-state-archived` plus `<time dateTime="2027-03-01T01:00:00.000Z">2027-03-01 09:00</time>` → unarchive → `scheduled` again (its Publish Time is still ahead) → permanent delete 204 → both empty messages → `DELETE` without a session 401 → `/admin/tags` 200, create `编辑器`, `PATCH rename` adds `en: Editor`, delete 204.

Acceptance-box → test map: (1) `components/admin/dashboard-table.test.tsx` ×7 (all four derived states rendered from `visibility`, never from `publicationState`; `<time dateTime>` + site-time label; both sections on one page; each row handed its derived visibility; empty lists) + `domain/publication-actions.test.ts` ×5 (the offers table, including the archive/unarchive mirror of the service guards) + the live schedule/archive/unarchive walk; (2) `services/categories.test.ts` (+18: name per Locale, move rewriting the whole subtree, move to root, append position, cycle refusal, collision refusal, reorder swap and both ends, delete refused on children / on Articles, delete after `moveArticlesTo`, unknown destination), `components/admin/catalogue-markup.test.tsx` (nested `<ul>` rather than a flat list, per-Locale name forms, a parent select that never offers itself or its descendants), `http/catalogue.test.ts` (the three write operations and every status code), plus the raw-SQL proof of `category_path_idx`; (3) `services/tags.test.ts` (+6: name per Locale, delete refused with both counts, delete when unused) + `http/catalogue.test.ts` tag cases + `catalogue-markup.test.tsx` tag table; (4) `catalogue-notices.test.ts` ×5 pin the interpolated refusal wording in `zh`, plus the live `Accept-Language: en` / `zh-CN` walk; (5) the keyboard checklist above, asserted structurally in `catalogue-markup.test.tsx` (real `button`/`select`/`label`/`details`/`summary` elements, no `draggable`, no hover-only operation, no Category offered as its own parent) and inspected by hand for tab order — this repo has no browser harness, per the spec's Testing Decisions.

Accepted scope notes: the confirmation dialog's focus trap, Esc and focus restoration are the asset picker's proven pattern copied into `confirm-dialog.tsx`; they are asserted as markup (`role="dialog" aria-modal="true"`, a labelled title, a danger button and a cancel button) plus by hand, not by a browser test. Drag-free reordering is deliberate — buttons are the keyboard-first equivalent and avoid a second interaction model. The dashboard is one page with two sections rather than one mixed table, because an Article has a Slug and a Post has none; "one place" is the page. Permanent delete of a Category still in use is impossible without naming a destination by design, so no bulk-move UI was built (bulk operations are out of scope). Category revision history, Tag merging and Tag reordering were not in the ticket and are not here.
