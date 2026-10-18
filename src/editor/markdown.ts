import type { JSONContent } from "@tiptap/core";
import { MarkdownManager } from "@tiptap/markdown";

import { isRichTextDocument } from "@/domain/rich-text";
import { articleExtensions } from "./extensions";

let manager: MarkdownManager | null = null;

function markdownManager(): MarkdownManager {
  manager ??= new MarkdownManager({ extensions: articleExtensions });
  return manager;
}

/**
 * The derived Markdown column. The ProseMirror JSON is the source of truth, so
 * this always runs from the JSON — never from Markdown the client sent.
 */
export function deriveMarkdown(bodyJson: string): string {
  if (!isRichTextDocument(bodyJson)) {
    return "";
  }
  try {
    return markdownManager().serialize(JSON.parse(bodyJson) as JSONContent);
  } catch {
    return "";
  }
}

/** Used by the editor's Markdown paste handler. */
export function parseMarkdown(markdown: string): JSONContent {
  return markdownManager().parse(markdown);
}

const MARKDOWN_SIGNALS = [
  /^#{1,6}\s/m,
  /^\s*[-*+]\s/m,
  /^\s*\d+\.\s/m,
  /^>\s/m,
  /^```/m,
  /^\s*\|.*\|\s*$/m,
  /^---\s*$/m,
  /^\s*\[\^[^\]\s]+\]:/m,
  /^> \[![a-z]+\]/m,
];

export function looksLikeMarkdown(text: string): boolean {
  return MARKDOWN_SIGNALS.some((pattern) => pattern.test(text));
}
