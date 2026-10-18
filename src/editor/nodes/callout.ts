import { Node, mergeAttributes, type MarkdownToken } from "@tiptap/core";

import { lineStart } from "./markdown-blocks";

/** The tones a Callout can carry. Rendered as `data-tone` in every surface. */
export const CALLOUT_TONES = ["note", "tip", "warn", "danger"] as const;

export type CalloutTone = (typeof CALLOUT_TONES)[number];

export function isCalloutTone(value: unknown): value is CalloutTone {
  return typeof value === "string" && (CALLOUT_TONES as readonly string[]).includes(value);
}

const CALLOUT_START = /^> \[!([a-z]+)\]/;
const CALLOUT_BLOCK = /^> \[![a-z]+\][^\n]*(?:\n>[^\n]*)*/;

/**
 * A toned Callout block. `renderHTML` is the shared markup: the admin editor's
 * own DOM and the Article renderer both use it, so a Callout cannot look
 * different in preview and on the public page.
 */
export const Callout = Node.create({
  name: "callout",
  group: "block",
  content: "block+",
  defining: true,

  addAttributes() {
    return {
      tone: {
        default: "note",
        parseHTML: (element) => element.getAttribute("data-tone"),
        renderHTML: (attributes) => ({ "data-tone": attributes.tone }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="callout"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "callout", class: "callout" }),
      ["div", { class: "callout-body" }, 0],
    ];
  },

  renderMarkdown(node, helpers) {
    const tone = isCalloutTone(node.attrs?.tone) ? node.attrs.tone : "note";
    const body = helpers.renderChildren(node).trim().replaceAll("\n", "\n> ");
    return `> [!${tone}]\n> ${body}`;
  },

  markdownTokenizer: {
    name: "callout",
    level: "block",
    // Anchored to a line start: marked truncates the surrounding paragraph at
    // this index, so an unanchored match would split prose that merely mentions
    // the marker.
    start: (src: string) => lineStart(src, /^> \[![a-z]+\]/m),
    tokenize: (src: string, _tokens: MarkdownToken[], lexer) => {
      const block = CALLOUT_BLOCK.exec(src);
      if (block === null) {
        return undefined;
      }
      const lines = block[0].trimEnd().split("\n").map((line) => line.replace(/^>\s?/, ""));
      // The first line is the `[!tone]` marker itself.
      return {
        type: "callout",
        raw: block[0],
        tone: CALLOUT_START.exec(block[0])?.[1] ?? "note",
        tokens: lexer.blockTokens(lines.slice(1).join("\n")),
      };
    },
  },

  parseMarkdown(token, helpers) {
    const tone = isCalloutTone(token.tone) ? token.tone : "note";
    return {
      type: "callout",
      attrs: { tone },
      content: helpers.parseChildren(token.tokens ?? []),
    };
  },
});
