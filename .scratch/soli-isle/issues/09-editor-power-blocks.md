# 09: Editor power blocks

**What to build:** The Article editor gains tables, footnotes, math formulas, callouts, and fold blocks — insertable via slash commands and Markdown, rendered correctly in preview and on the public page — plus drag-to-reorder of blocks.

**Blocked by:** 05 — First published Article; 07 — Public article reading

**Status:** ready-for-agent

- [x] Tables, footnotes, math, callouts, and fold blocks insert via slash command (and Markdown input where applicable) and render correctly in editor preview and on public Article pages.
- [x] Math formulas render correctly in published Articles.
- [x] Callouts and fold blocks render with their intended structure; a fold block starts collapsed and expands on demand.
- [x] Blocks can be reordered by dragging.
- [x] Undo/redo covers every new block operation.

## Comments

One extension list, one renderer, no migration. Every new block is a node in `src/editor/extensions.ts`, so the editor, the Markdown derivation and the server renderer cannot disagree about the schema; the browser output on the public page still comes only from `renderArticleBody`'s `nodeMapping` seam.

**The math trap, solved in the renderer.** `@tiptap/extension-mathematics` only emits a marker element from `renderHTML` (`<div data-type="block-math" data-latex="…"></div>`) — the KaTeX markup lives in the client node view. `render-article.ts` now maps `blockMath`/`inlineMath` through `src/editor/render/math.ts` (`katex.renderToString`), `katex` is pinned to **exactly `0.18.10`** in `package.json` (`^0.18.10` would resolve to the deprecated `0.18.11`), and `katex/dist/katex.min.css` is imported once in each document root (`src/app/[locale]/layout.tsx`, `src/app/admin/admin-document.tsx`). Result: published math renders as KaTeX, and no `data-type="block-math"` marker survives in the HTML.

- **Tables** — `TableKit` (`resizable: false`). The renderer emits the real `<table>/<colgroup>/<thead|tbody>/<th>/<td>` the extension's `renderHTML` produces; slash items cover insert, add row/column and delete row/column/table, and the row/column items are only listed while the cursor is inside a table (`SlashItem.available`).
- **Footnotes** — three custom nodes in `src/editor/nodes/footnotes.ts`: inline `footnoteRef`, `footnoteSection` (a `block` holding `footnoteItem+`), and `footnoteItem`. The label is stored in the JSON at insert time (max+1), because the Markdown serialiser and the static renderer are per-node callbacks with no shared traversal state to count through. `insertFootnote()` writes the reference *and* its note (creating the section at the end of the body when there is none) in **one transaction**, so one undo takes both. The reader-facing structure — `<section class="footnotes"><ol>`, `id="fn-1"`, and a `↩` back-link to `#fnref-1` — is produced by a `footnoteItem` mapping in `render-article.ts`; its `aria-label` comes from the new `reader.article.footnoteBack` message via `ArticleBodyOptions.footnoteBackLabel`, which both the public page and the preview route pass, so preview and publication match.
- **Callouts** — custom `callout` node (`src/editor/nodes/callout.ts`) with a `tone` attribute (`note | tip | warn | danger`). It renders `div[data-type="callout"][data-tone] > div.callout-body`; the tone is editable from the toolbar when the cursor is in a callout, and the four tones are styled from the existing tokens with `color-mix` only.
- **Fold blocks** — `@tiptap/extension-details` with `persist: false` (the default), so the open state never enters the document and the public page renders a native `<details>` that expands **with no JavaScript**. `renderToggleButton` is overridden to add a visible `▸/▾` glyph and `aria-expanded` (the default renders an empty button).
- **Markdown.** Everything the derived column can hold now round-trips. Tables, math (`$$…$$` / `$…$`) and fold blocks (`:::details`) work out of the box; callouts (`> [!warn]`) and footnotes (`[^1]` + `[^1]: note`) needed `markdownTokenizer`s copied from the shape `@tiptap/extension-mathematics` uses. The footnote round-trip was written **red first** — without the tokenizers `serialize` produced `\[^1\]` and `parse` produced plain text, exactly as the research note predicted. Two things worth knowing for whoever touches them: marked requires a block tokenizer to declare `start` (a block tokenizer without one silently empties every paragraph's inline content), and its `start` truncates the surrounding paragraph, so both tokenizers anchor it to a **line start** (`lineStart()` in `src/editor/nodes/markdown-blocks.ts`) — an unanchored match injects a stray newline into prose that merely mentions the marker. Typed shortcuts remain the math extension's own (`$$x$$` inline, `$$$x$$$` block); the Markdown form used for the derived column and for paste is `$x$` / `$$\nx\n$$`.
- **Drag-to-reorder** — `@tiptap/extension-drag-handle-react`'s `<DragHandle editor={editor}>` in `article-editor.tsx`, with `nested` left at its default `false` so only root-level blocks get a handle. Chunk cost was measured, not assumed (see below) and the fallback was not needed.
- **Slash menu** — `createSlashItems(labels.slash, labels.editor, hooks)` gained table, add/delete row and column, callout, fold block, formula block, inline formula and footnote. Formulas prompt for LaTeX like the existing link/code-language prompts do. `editor/markdown.ts`'s paste detector learned the two new block signals.
- **New dependencies**: `@tiptap/extension-table`, `@tiptap/extension-details`, `@tiptap/extension-mathematics`, `@tiptap/extension-drag-handle`, `@tiptap/extension-drag-handle-react`, `@tiptap/extension-node-range`, `@tiptap/extension-collaboration`, `@tiptap/y-tiptap` (all `^3.32.0` / `^3.0.10`, lockstep with the existing TipTap tree), `katex` at exactly `0.18.10`, and the devDependency `happy-dom` (below).

**Bundle cost, measured** (`next build`, `/admin/articles/[articleId]` — the only route that ships the editor):

| build | route size | first-load JS |
|---|---|---|
| `dev` tip before this ticket | 170 kB | 278 kB |
| + power blocks (table, details, math, callout, footnotes) | 267 kB | 376 kB |
| + drag handle (final) | 320 kB | 429 kB |

The drag handle costs **+53 kB** and pulls `yjs` into a 470 kB *raw* (uncompressed) admin chunk; the research note feared ~2.6 MB, which is the unpacked size, not the shipped cost. 53 kB for a required feature on an admin-only route was judged acceptable, so the `@dnd-kit` fallback was not needed. The public Article route is unchanged at **108 kB** first-load — KaTeX is server-rendered, so no math JS reaches readers.

**Acceptance box → test**

| Acceptance | Evidence |
|---|---|
| 1. Every block inserts via slash command and renders in both places | `src/editor/editor-blocks.test.ts` — one case per block inserts it through the real `createSlashItems(...)` over a typed `/` and asserts the resulting document; `src/editor/render/render-article.test.ts` asserts the rendered HTML for table, callout, fold block, footnotes and math |
| 2. Math renders in published Articles | `render-article.test.ts` "renders math as KaTeX instead of the extension's marker element" asserts `class="katex"` and the absence of the marker attributes; the live smoke below confirmed it end to end |
| 3. Callouts/fold blocks structured, fold starts collapsed | `render-article.test.ts`: `data-type="callout"` + `data-tone="warn"` + `class="callout-body"`; `<details>` + `<summary>` + body with **no** `open=`; `editor-blocks.test.ts` asserts a freshly inserted fold block has no `open` attribute |
| 4. Blocks reorder by dragging | `editor-blocks.test.ts` "attaches a block drag handle to the editor" mounts the real `<DragHandle>` against the real extension list and finds the handle in the DOM; the mechanics are the package's (`nested: false` = root-level only) |
| 5. Undo/redo covers every new operation | `editor-blocks.test.ts` "undo and redo" — for each of the six slash items: document changes, `undo()` restores the exact previous JSON, `redo()` restores the new one; plus "undoes a footnote reference and its note in one step" |

Also `src/editor/markdown.test.ts` — six round-trip cases (`parseMarkdown(deriveMarkdown(doc))` deep-equals the original document) for table, math, fold block, callout, one footnote, and two footnotes.

Validation: `npx tsc --noEmit` clean; `npm run lint` 0 errors (only the pre-existing `eslint.config.mjs` warning); `npm test` **47 files / 439 tests** green (26 new: round-trip 6, editor blocks 15, renderer 5); `npm run build` succeeds with the chunk numbers above. A live `next start` on port 3109 against a temp database, with one published Article holding all five blocks, served `/en/articles/smoke-blocks` **200** with exactly one `class="katex"`, `katex-display`, no `data-type="block-math"`, `<table>`, `<th><p>metric</p></th>`, `data-type="callout"` + `data-tone="warn"`, `<details>` + `<summary>` with **zero** `open=""`, `<section class="footnotes">` + `id="fn-1"` + `href="#fnref-1"` + `aria-label="Back to the text"`, and the KaTeX stylesheet in the page's CSS.

Accepted limitations: (1) footnote numbers are fixed at insert time — deleting a note does not renumber the rest, and a note is one paragraph (that is what makes `[^1]: …` lossless); (2) a footnote's back-link needs a label the renderer cannot invent, so it arrives through `ArticleBodyOptions.footnoteBackLabel` (a surface that forgets to pass it renders the anchor without an `aria-label`); (3) the editor's fold-block toggle button carries a `▸/▾` glyph and `aria-expanded` but no localized accessible name, because the node view is built outside React where the messages are not reachable; (4) drag-reorder itself is the third-party native drag interaction — the test proves the handle is attached to the editor with the production extension list, and an interactive drag was checked by hand rather than in a browser harness.

Verification note for the merger: the editor now needs `happy-dom` (devDependency) because `src/editor/editor-blocks.test.ts` and the drag-handle case run under `// @vitest-environment happy-dom`; `vitest.config.ts` was left untouched (per-file environment only), and `@tiptap/html` is still not used.
