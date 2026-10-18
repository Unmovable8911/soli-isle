import "server-only";

import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { renderToHTMLString } from "@tiptap/static-renderer/pm/html-string";

import { isRichTextDocument } from "@/domain/rich-text";
import { articleExtensions } from "../extensions";
import { escapeHtml, getHighlighter, highlightCode } from "./highlighter";
import { imageSrcset } from "./image-srcset";

const IMAGE_SIZES = "(max-width: 900px) 100vw, 800px";

function renderImage(node: ProseMirrorNode): string {
  const src = typeof node.attrs.src === "string" ? node.attrs.src : "";
  const alt = typeof node.attrs.alt === "string" ? node.attrs.alt : "";
  const attributes = [`src="${escapeHtml(src)}"`, `alt="${escapeHtml(alt)}"`, 'loading="lazy"'];

  const srcset = imageSrcset(src);
  if (srcset !== null) {
    attributes.push(`srcset="${escapeHtml(srcset)}"`, `sizes="${IMAGE_SIZES}"`);
  }
  for (const dimension of ["width", "height"] as const) {
    const value = node.attrs[dimension];
    if (typeof value === "number" && Number.isFinite(value)) {
      attributes.push(`${dimension}="${value}"`);
    }
  }

  return `<img ${attributes.join(" ")} />`;
}

/**
 * The one content renderer: the admin preview today, the public Article page in
 * ticket 07. The `nodeMapping` seam is where ticket 09 injects math, callouts
 * and fold blocks.
 */
export async function renderArticleBody(bodyJson: string): Promise<string> {
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
        image: ({ node }) => renderImage(node),
      },
    },
  });
}
