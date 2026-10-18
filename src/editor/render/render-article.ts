import "server-only";

import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { renderToHTMLString } from "@tiptap/static-renderer/pm/html-string";

import { isRichTextDocument } from "@/domain/rich-text";
import { articleExtensions } from "../extensions";
import { escapeHtml, getHighlighter, highlightCode } from "./highlighter";
import { imageSrcset } from "./image-srcset";
import { renderMath } from "./math";

const IMAGE_SIZES = "(max-width: 900px) 100vw, 800px";

/**
 * Above this height-to-width ratio an image counts as an extremely tall one:
 * CSS contains it within the viewport instead of letting it push the article
 * off the screen. It is never cropped.
 */
export const TALL_IMAGE_RATIO = 2;

export interface ArticleBodyImage {
  /** The untouched upload, which the lightbox opens. */
  original: string;
  width: number;
  height: number;
}

export interface ArticleBodyOptions {
  /**
   * Resolves a body image's stored Asset. The renderer holds no database
   * access, so the page supplies the original address and true dimensions.
   */
  resolveImage?: (src: string) => ArticleBodyImage | null;
  /**
   * The accessible name of a footnote's back-link. The renderer holds no
   * messages, so the surface that knows the Locale supplies it.
   */
  footnoteBackLabel?: string;
}

function attribute(node: ProseMirrorNode, key: string): string {
  const value: unknown = node.attrs[key];
  return typeof value === "string" ? value : "";
}

function dimension(node: ProseMirrorNode, key: "width" | "height"): number | null {
  const value: unknown = node.attrs[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function renderImage(
  node: ProseMirrorNode,
  resolveImage: ArticleBodyOptions["resolveImage"],
): string {
  const src = typeof node.attrs.src === "string" ? node.attrs.src : "";
  const alt = typeof node.attrs.alt === "string" ? node.attrs.alt : "";
  const resolved = src.length > 0 && resolveImage !== undefined ? resolveImage(src) : null;

  const width = resolved?.width ?? dimension(node, "width");
  const height = resolved?.height ?? dimension(node, "height");
  const isTall = width !== null && height !== null && height / width > TALL_IMAGE_RATIO;

  const attributes = [
    `src="${escapeHtml(src)}"`,
    `alt="${escapeHtml(alt)}"`,
    'loading="lazy"',
    `class="article-image${isTall ? " article-image--tall" : ""}"`,
  ];

  const srcset = imageSrcset(src);
  if (srcset !== null) {
    attributes.push(`srcset="${escapeHtml(srcset)}"`, `sizes="${IMAGE_SIZES}"`);
  }
  if (resolved !== null) {
    attributes.push(`data-original="${escapeHtml(resolved.original)}"`);
  }
  if (width !== null) {
    attributes.push(`width="${width}"`);
  }
  if (height !== null) {
    attributes.push(`height="${height}"`);
  }

  return `<img ${attributes.join(" ")} />`;
}

function renderFootnoteItem(
  node: ProseMirrorNode,
  children: string | string[],
  backLabel: string | undefined,
): string {
  const label = escapeHtml(attribute(node, "label") || "1");
  const body = Array.isArray(children) ? children.join("") : children;
  const name = backLabel === undefined ? "" : ` aria-label="${escapeHtml(backLabel)}"`;
  return (
    `<li data-type="footnote-item" data-label="${label}" id="fn-${label}">${body}` +
    `<a class="footnote-back" href="#fnref-${label}"${name}>\u21a9</a></li>`
  );
}

/**
 * The one content renderer: the admin preview and the public Article page.
 * The `nodeMapping` seam is where ticket 09 injects math, callouts and fold
 * blocks rather than adding a second rendering path.
 */
export async function renderArticleBody(
  bodyJson: string,
  options: ArticleBodyOptions = {},
): Promise<string> {
  if (!isRichTextDocument(bodyJson)) {
    return "";
  }

  const highlighter = await getHighlighter();

  return renderToHTMLString({
    content: JSON.parse(bodyJson) as Parameters<typeof renderToHTMLString>[0]["content"],
    extensions: articleExtensions,
    options: {
      nodeMapping: {
        codeBlock: ({ node }) =>
          highlightCode(highlighter, node.textContent, node.attrs.language ?? null),
        image: ({ node }) => renderImage(node, options.resolveImage),
        blockMath: ({ node }) => renderMath(attribute(node, "latex"), true),
        inlineMath: ({ node }) => renderMath(attribute(node, "latex"), false),
        footnoteItem: ({ node, children }) =>
          renderFootnoteItem(node, children ?? "", options.footnoteBackLabel),
      },
    },
  });
}
