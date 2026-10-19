# editor-nodes

- **Parent**: editor
- **Purpose**: Supplies the Article body's own TipTap nodes — the toned Callout, the footnote reference/item/section trio and the `lineStart` helper their Markdown block tokenizers anchor on — on top of the stock extensions.
- **Key Files**:
  - `src/editor/nodes/callout.ts` (toned Callout node, `CALLOUT_TONES`)
  - `src/editor/nodes/footnotes.ts` (footnote ref, item, section, insert)
  - `src/editor/nodes/markdown-blocks.ts` (`lineStart` tokenizer anchor)
- **Dependencies**: none
- **Dependents**: components-admin, editor
- **Exposes**:
  - Node extensions registered into `articleExtensions`: `Callout`, `FootnoteReference`, `FootnoteItem`, `FootnoteSection`.
  - Authoring helpers for `components-admin`: `insertFootnote({ editor, range })` (slash-menu command) and `CALLOUT_TONES` / `isCalloutTone` (the tone picker).
  - `lineStart(src, pattern)` — shared by both block tokenizers, so a marker match always reports a line-start index and never truncates prose that merely mentions it.

## Internal Structure
- Each node carries its own Markdown support inline (`markdownTokenizer`, `parseMarkdown`, `renderMarkdown`), so a node's three surfaces — editor DOM, Markdown, rendered HTML — live in one file.
- `footnotes.ts` is the only multi-node file: the reference stores its number in `data-label` because the renderer and the serialiser are per-node callbacks with no shared traversal state for a counter.
- The HTML these nodes emit is the shared markup: the admin editor's DOM and `editor-render` both derive from the same `renderHTML`, so a Callout cannot differ between preview and the public page.
