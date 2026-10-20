# editor-render

- **Parent**: editor
- **Purpose**: Renders stored ProseMirror JSON into the reader HTML — heading anchors, shiki-highlighted code, KaTeX math, footnote back-links and responsive image `srcset` — with no database or message access of its own.
- **Key Files**:
  - `src/editor/render/render-article.ts` (`renderArticleBody`, single content renderer)
  - `src/editor/render/highlighter.ts` (process-wide shiki instance, `CODE_THEME`)
  - `src/editor/render/image-srcset.ts` (display/thumb webp candidates)
  - `src/editor/render/math.ts` (KaTeX string rendering)
- **Dependencies**: domain, editor
- **Dependents**: app-locale, http
- **Exposes**:
  - `renderArticleBody(bodyJson, options)` — the one renderer behind both the admin preview and the public Article page; used by `http` and by the `app-locale` article page.
  - `ArticleBodyOptions` — the two seams the caller fills because the renderer holds neither: `resolveImage(src)` (original address and true dimensions for the lightbox) and `footnoteBackLabel`.
  - `imageSrcset(src)` — imported by `http/posts.ts` to build Feed image candidates.
  - `TALL_IMAGE_RATIO`, `ArticleBodyImage`.

## Data Flow
1. A surface that already holds the `Locale` messages passes `bodyJson` plus `footnoteBackLabel`, and `resolveImage` when it can reach Assets.
2. `renderArticleBody` gates on `isRichTextDocument` and awaits `getHighlighter()` — one `HighlighterCore` per process, built on the JS regex engine to keep WASM out of Next.
3. `renderToHTMLString` walks the document with `articleExtensions`.
4. Its `nodeMapping` seam swaps in the five specialised renderers: `renderHeading` (anchors via `createHeadingAnchors`), `highlightCode`, `renderImage` (srcset + original), `renderMath` and `renderFootnoteItem`.
5. The result is one HTML string — no second rendering path exists for preview versus published.

## Internal Structure
- `render-article.ts` owns traversal and every node override; the three siblings are single-purpose helpers it calls, each depending on one external engine (shiki, katex, the `/media/<id>/<variant>.<ext>` address format).
- `server-only` is imported by `render-article.ts`, `highlighter.ts` and `math.ts`, so the whole render path is fenced off from client bundles.
