import {
  Node,
  findChildren,
  type Editor,
  type JSONContent,
  type MarkdownToken,
  type Range,
} from "@tiptap/core";

import { lineStart } from "./markdown-blocks";

const DEFINITION_LINE = /^\[\^([^\]\s]+)\]:[ \t]?([^\n]*)(?:\n|$)/;
const DEFINITION_BLOCK = /^(?:\[\^[^\]\s]+\]:[ \t]?[^\n]*(?:\n|$))+/;
const REFERENCE = /^\[\^([^\]\s]+)\]/;

function labelOf(attrs: JSONContent["attrs"]): string {
  const label = attrs?.label;
  return typeof label === "string" && label.length > 0 ? label : "1";
}

function labelAttribute() {
  return {
    label: {
      default: "1",
      parseHTML: (element: HTMLElement) => element.getAttribute("data-label"),
      renderHTML: (attributes: Record<string, unknown>) => ({ "data-label": labelOf(attributes) }),
    },
  };
}

/**
 * An inline footnote reference. Its number is stored in the document, not
 * counted at render time: the renderer and the Markdown serialiser are per-node
 * callbacks with no shared traversal state, so a counter has nowhere to live.
 */
export const FootnoteReference = Node.create({
  name: "footnoteRef",
  group: "inline",
  inline: true,
  atom: true,
  selectable: false,

  addAttributes: labelAttribute,

  parseHTML() {
    return [{ tag: "sup[data-footnote-ref]" }];
  },

  renderHTML({ node }) {
    const label = labelOf(node.attrs);
    return [
      "sup",
      { "data-footnote-ref": "", "data-label": label, id: `fnref-${label}` },
      ["a", { href: `#fn-${label}`, class: "footnote-ref" }, label],
    ];
  },

  renderMarkdown(node) {
    return `[^${labelOf(node.attrs)}]`;
  },

  markdownTokenizer: {
    name: "footnoteRef",
    level: "inline",
    start: (src: string) => src.indexOf("[^"),
    tokenize: (src: string) => {
      const match = REFERENCE.exec(src);
      if (match === null) {
        return undefined;
      }
      return { type: "footnoteRef", raw: match[0], label: match[1] };
    },
  },

  parseMarkdown(token) {
    return { type: "footnoteRef", attrs: { label: String(token.label ?? "1") } };
  },
});

/**
 * One note. A note is a single paragraph so the Markdown definition
 * (`[^1]: text`) round-trips without losing structure.
 */
export const FootnoteItem = Node.create({
  name: "footnoteItem",
  content: "paragraph",
  defining: true,

  addAttributes: labelAttribute,

  parseHTML() {
    return [{ tag: 'li[data-type="footnote-item"]' }];
  },

  renderHTML({ node }) {
    const label = labelOf(node.attrs);
    return ["li", { "data-type": "footnote-item", "data-label": label, id: `fn-${label}` }, 0];
  },

  renderMarkdown(node, helpers) {
    return `[^${labelOf(node.attrs)}]: ${helpers.renderChildren(node).trim()}`;
  },
});

/**
 * The ordered list of notes. It is an ordinary block, so the Author decides
 * where it sits; the reader-facing back-links come from the renderer.
 */
export const FootnoteSection = Node.create({
  name: "footnoteSection",
  group: "block",
  content: "footnoteItem+",
  defining: true,
  isolating: true,

  parseHTML() {
    return [{ tag: 'section[data-type="footnote-section"]' }];
  },

  renderHTML() {
    return [
      "section",
      { "data-type": "footnote-section", class: "footnotes" },
      ["ol", { class: "footnote-list" }, 0],
    ];
  },

  renderMarkdown(node, helpers) {
    return helpers.renderChildren(node, "\n");
  },

  markdownTokenizer: {
    name: "footnoteSection",
    level: "block",
    // Only a definition *line* truncates the surrounding paragraph; a bare
    // `[^1]` reference must never split the prose it sits in.
    start: (src: string) => lineStart(src, /^\[\^[^\]\s]+\]:/m),
    tokenize: (src: string, _tokens: MarkdownToken[], lexer) => {
      const block = DEFINITION_BLOCK.exec(src);
      if (block === null) {
        return undefined;
      }
      const notes: Array<{ label: string; tokens: MarkdownToken[] }> = [];
      for (const line of block[0].split("\n")) {
        const definition = DEFINITION_LINE.exec(`${line}\n`);
        if (definition === null) {
          continue;
        }
        notes.push({ label: definition[1], tokens: lexer.inlineTokens(definition[2]) });
      }
      return { type: "footnoteSection", raw: block[0], notes };
    },
  },

  parseMarkdown(token, helpers) {
    const notes: Array<{ label: string; tokens: MarkdownToken[] }> = token.notes ?? [];
    return {
      type: "footnoteSection",
      content: notes.map((note) => ({
        type: "footnoteItem",
        attrs: { label: note.label },
        content: [{ type: "paragraph", content: helpers.parseInline(note.tokens ?? []) }],
      })),
    };
  },
});

function nextLabel(doc: Editor["state"]["doc"]): string {
  let highest = 0;
  doc.descendants((node) => {
    if (node.type.name !== "footnoteRef" && node.type.name !== "footnoteItem") {
      return true;
    }
    const value = Number.parseInt(String(node.attrs.label ?? ""), 10);
    highest = Number.isNaN(value) ? highest : Math.max(highest, value);
    return false;
  });
  return String(highest + 1);
}

/**
 * Drops a reference at the cursor and puts its note in the section, creating
 * the section at the end of the body when the Author has not made one yet.
 * Everything lands in a single transaction, so one undo takes both.
 */
export function insertFootnote({ editor, range }: { editor: Editor; range: Range }): void {
  const { state } = editor;
  const label = nextLabel(state.doc);
  const note = state.schema.nodes.footnoteItem.create(
    { label },
    state.schema.nodes.paragraph.create(),
  );

  let transaction = state.tr.replaceWith(
    range.from,
    range.to,
    state.schema.nodes.footnoteRef.create({ label }),
  );

  const [section] = findChildren(transaction.doc, (node) => node.type.name === "footnoteSection");
  transaction =
    section === undefined
      ? transaction.insert(
          transaction.doc.content.size,
          state.schema.nodes.footnoteSection.create(null, note),
        )
      : transaction.insert(section.pos + section.node.nodeSize - 1, note);

  editor.view.dispatch(transaction);
  editor.commands.focus();
}
