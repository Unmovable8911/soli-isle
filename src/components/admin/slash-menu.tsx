"use client";

import { Extension } from "@tiptap/core";
import type { Editor, Range } from "@tiptap/core";
import { ReactRenderer } from "@tiptap/react";
import { Suggestion, type SuggestionProps } from "@tiptap/suggestion";
import { forwardRef, useImperativeHandle, useState } from "react";

import { insertFootnote } from "@/editor/nodes/footnotes";
import type { Messages } from "@/messages";

export type SlashLabels = Messages["admin"]["articles"]["slash"];
export type SlashEditorLabels = Messages["admin"]["articles"]["editor"];

export interface SlashItem {
  key: string;
  title: string;
  /** Off while the command cannot run at the current selection. */
  available?: (editor: Editor) => boolean;
  run: (props: { editor: Editor; range: Range }) => void;
}

export interface SlashListHandle {
  onKeyDown: (event: KeyboardEvent) => boolean;
}

interface SlashListProps {
  items: SlashItem[];
  command: (item: SlashItem) => void;
  empty: string;
}

const SlashList = forwardRef<SlashListHandle, SlashListProps>(function SlashList(
  { items, command, empty },
  ref,
) {
  const [selected, setSelected] = useState(0);
  const active = Math.min(selected, Math.max(0, items.length - 1));

  useImperativeHandle(ref, () => ({
    onKeyDown(event: KeyboardEvent): boolean {
      if (items.length === 0) {
        return false;
      }
      if (event.key === "ArrowDown") {
        setSelected((current) => (current + 1) % items.length);
        return true;
      }
      if (event.key === "ArrowUp") {
        setSelected((current) => (current - 1 + items.length) % items.length);
        return true;
      }
      if (event.key === "Enter") {
        const item = items[active];
        if (item !== undefined) {
          command(item);
        }
        return true;
      }
      return false;
    },
  }));

  if (items.length === 0) {
    return <div className="slash-menu slash-menu-empty">{empty}</div>;
  }

  return (
    <div className="slash-menu" role="listbox">
      {items.map((item, index) => (
        <button
          key={item.key}
          type="button"
          role="option"
          aria-selected={index === active}
          className={`slash-menu-item${index === active ? " slash-menu-item-active" : ""}`}
          onMouseDown={(event) => {
            event.preventDefault();
            command(item);
          }}
        >
          {item.title}
        </button>
      ))}
    </div>
  );
});

export function createSlashItems(
  labels: SlashLabels,
  editorLabels: SlashEditorLabels,
  hooks: { onInsertImage: () => void },
): SlashItem[] {
  return [
    {
      key: "paragraph",
      title: labels.paragraph,
      run: ({ editor, range }) => editor.chain().focus().deleteRange(range).setParagraph().run(),
    },
    {
      key: "heading2",
      title: labels.heading2,
      run: ({ editor, range }) =>
        editor.chain().focus().deleteRange(range).setHeading({ level: 2 }).run(),
    },
    {
      key: "heading3",
      title: labels.heading3,
      run: ({ editor, range }) =>
        editor.chain().focus().deleteRange(range).setHeading({ level: 3 }).run(),
    },
    {
      key: "bulletList",
      title: labels.bulletList,
      run: ({ editor, range }) =>
        editor.chain().focus().deleteRange(range).toggleBulletList().run(),
    },
    {
      key: "orderedList",
      title: labels.orderedList,
      run: ({ editor, range }) =>
        editor.chain().focus().deleteRange(range).toggleOrderedList().run(),
    },
    {
      key: "taskList",
      title: labels.taskList,
      run: ({ editor, range }) =>
        editor.chain().focus().deleteRange(range).toggleTaskList().run(),
    },
    {
      key: "blockquote",
      title: labels.blockquote,
      run: ({ editor, range }) =>
        editor.chain().focus().deleteRange(range).toggleBlockquote().run(),
    },
    {
      key: "codeBlock",
      title: labels.codeBlock,
      run: ({ editor, range }) =>
        editor.chain().focus().deleteRange(range).toggleCodeBlock().run(),
    },
    {
      key: "horizontalRule",
      title: labels.horizontalRule,
      run: ({ editor, range }) =>
        editor.chain().focus().deleteRange(range).setHorizontalRule().run(),
    },
    {
      key: "table",
      title: labels.table,
      run: ({ editor, range }) =>
        editor.chain().focus().deleteRange(range).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
    },
    {
      key: "addRow",
      title: labels.addRow,
      available: (editor) => editor.can().addRowAfter(),
      run: ({ editor }) => editor.chain().focus().addRowAfter().run(),
    },
    {
      key: "addColumn",
      title: labels.addColumn,
      available: (editor) => editor.can().addColumnAfter(),
      run: ({ editor }) => editor.chain().focus().addColumnAfter().run(),
    },
    {
      key: "deleteRow",
      title: labels.deleteRow,
      available: (editor) => editor.can().deleteRow(),
      run: ({ editor }) => editor.chain().focus().deleteRow().run(),
    },
    {
      key: "deleteColumn",
      title: labels.deleteColumn,
      available: (editor) => editor.can().deleteColumn(),
      run: ({ editor }) => editor.chain().focus().deleteColumn().run(),
    },
    {
      key: "deleteTable",
      title: labels.deleteTable,
      available: (editor) => editor.can().deleteTable(),
      run: ({ editor }) => editor.chain().focus().deleteTable().run(),
    },
    {
      key: "callout",
      title: labels.callout,
      run: ({ editor, range }) =>
        editor.chain().focus().deleteRange(range).toggleWrap("callout").run(),
    },
    {
      key: "details",
      title: labels.details,
      run: ({ editor, range }) =>
        editor.chain().focus().deleteRange(range).setDetails().run(),
    },
    {
      key: "mathBlock",
      title: labels.mathBlock,
      run: ({ editor, range }) => {
        const latex = window.prompt(editorLabels.mathPrompt, "e = mc^2");
        if (latex === null) {
          return;
        }
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .insertContent({ type: "blockMath", attrs: { latex } })
          .run();
      },
    },
    {
      key: "mathInline",
      title: labels.mathInline,
      run: ({ editor, range }) => {
        const latex = window.prompt(editorLabels.mathPrompt, "a^2 + b^2");
        if (latex === null) {
          return;
        }
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .insertContent({ type: "inlineMath", attrs: { latex } })
          .run();
      },
    },
    {
      key: "footnote",
      title: labels.footnote,
      run: ({ editor, range }) => insertFootnote({ editor, range }),
    },
    {
      key: "image",
      title: labels.image,
      run: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).run();
        hooks.onInsertImage();
      },
    },
  ];
}

/** The extension list stays in one module; only the shell adds this plugin. */
export function createSlashCommand(items: () => SlashItem[], empty: string): Extension {
  return Extension.create({
    name: "slashCommand",
    addProseMirrorPlugins() {
      return [
        Suggestion<SlashItem, SlashItem>({
          editor: this.editor,
          char: "/",
          startOfLine: false,
          items: ({ editor, query }) =>
            items().filter(
              (item) =>
                item.title.toLowerCase().includes(query.toLowerCase()) &&
                (item.available?.(editor) ?? true),
            ),
          command: ({ editor, range, props }) => props.run({ editor, range }),
          render: () => {
            let component: ReactRenderer<SlashListHandle> | null = null;
            let unmount: (() => void) | null = null;

            return {
              onStart: (props: SuggestionProps<SlashItem, SlashItem>) => {
                component = new ReactRenderer(SlashList, {
                  props: {
                    items: props.items,
                    empty,
                    command: (item: SlashItem) => props.command(item),
                  },
                  editor: props.editor,
                });
                unmount = props.mount(component.element);
              },
              onUpdate: (props: SuggestionProps<SlashItem, SlashItem>) => {
                component?.updateProps({
                  items: props.items,
                  command: (item: SlashItem) => props.command(item),
                });
              },
              onKeyDown: (props) => {
                if (props.event.key === "Escape") {
                  unmount?.();
                  unmount = null;
                  return true;
                }
                return component?.ref?.onKeyDown(props.event) ?? false;
              },
              onExit: () => {
                unmount?.();
                unmount = null;
                component?.destroy();
                component = null;
              },
            };
          },
        }),
      ];
    },
  });
}
