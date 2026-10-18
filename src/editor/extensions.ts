import type { Extensions } from "@tiptap/core";
import Highlight from "@tiptap/extension-highlight";
import Image from "@tiptap/extension-image";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import StarterKit from "@tiptap/starter-kit";

/**
 * The Article body schema. The editor, the Markdown derivation and the server
 * renderer all read this one list, so a node cannot exist in one and be missing
 * from another. Ticket 09 appends its power blocks here.
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
];
