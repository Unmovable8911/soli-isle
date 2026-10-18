import type { Extensions } from "@tiptap/core";
import { Details, DetailsContent, DetailsSummary } from "@tiptap/extension-details";
import Highlight from "@tiptap/extension-highlight";
import Image from "@tiptap/extension-image";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { Mathematics } from "@tiptap/extension-mathematics";
import { TableKit } from "@tiptap/extension-table";
import StarterKit from "@tiptap/starter-kit";

import { Callout } from "./nodes/callout";
import { FootnoteItem, FootnoteReference, FootnoteSection } from "./nodes/footnotes";

/**
 * The Article body schema. The editor, the Markdown derivation and the server
 * renderer all read this one list, so a node cannot exist in one and be missing
 * from another.
 */
export const articleExtensions: Extensions = [
  StarterKit.configure({
    heading: { levels: [2, 3, 4] },
    codeBlock: { languageClassPrefix: "language-" },
    link: { openOnClick: false, autolink: true },
  }),
  Highlight,
  Image.configure({ allowBase64: false }),
  TaskList,
  TaskItem.configure({ nested: true }),
  TableKit.configure({ table: { resizable: false } }),
  // `persist: false` keeps the open state out of the document: a fold block is
  // always collapsed on first paint and expands through native <details>.
  Details.configure({
    persist: false,
    openClassName: "is-open",
    // The default renders an empty button. A glyph plus `aria-expanded` keeps
    // the toggle visible and its state readable without inventing a language.
    renderToggleButton: ({ element, isOpen }) => {
      element.classList.add("details-toggle");
      element.textContent = isOpen ? "\u25be" : "\u25b8";
      element.setAttribute("aria-expanded", String(isOpen));
    },
  }),
  DetailsSummary,
  DetailsContent,
  Mathematics.configure({ katexOptions: { throwOnError: false } }),
  Callout,
  FootnoteReference,
  FootnoteItem,
  FootnoteSection,
];
