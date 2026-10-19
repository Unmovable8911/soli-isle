# editor

- **Purpose**: `src/editor/extensions.ts` is the single Article body schema list that the admin editor, the Markdown derivation and the server renderer all read, and `src/editor/markdown.ts` turns ProseMirror JSON into the stored Markdown column and back for paste.
- **Key Files**:
  - `src/editor/extensions.ts` (the shared Article body schema)
  - `src/editor/markdown.ts` (Markdown serialise, parse, paste sniff)
- **Dependencies**: domain, editor-nodes
- **Dependents**: components-admin, editor-render, services
- **Exposes**:
  - `articleExtensions` — StarterKit (headings 2/3/4), Highlight, Image, TaskList/TaskItem, TableKit, Details with a custom toggle, Mathematics and the three custom nodes; imported by `components-admin` (TipTap `Editor`) and `editor-render` (`renderToHTMLString`).
  - Markdown surface: `deriveMarkdown(bodyJson)` (serialises a stored document, returns `""` for a non-document or a serialisation failure) and `parseMarkdown(markdown)`, both used by `components-admin`'s paste handler; `services` uses only `deriveMarkdown`.
  - `looksLikeMarkdown(text)` — the signal regexes that stop a paste of ordinary prose from being parsed.

## Data Flow
1. The admin client sends ProseMirror JSON as `bodyJson` to an `http` mutation or preview handler.
2. `services/articles` and `services/posts` call `deriveMarkdown(bodyJson)` when writing `bodyMarkdown`.
3. `deriveMarkdown` gates on `isRichTextDocument`, then serialises through the one `MarkdownManager` built over `articleExtensions`.
4. Readers never see that column: pages and the Feed re-render `bodyJson` through `editor-render`, so Markdown is a derived artefact, never a source.

## Internal Structure
- Two files, two directions: `extensions.ts` is the schema both halves share and `markdown.ts` is the only Markdown boundary; adding a node means touching `editor-nodes` and registering it here, nothing else.
- `editor-blocks.test.ts` asserts the editor DOM, the Markdown round-trip and the renderer agree on the same block set.
