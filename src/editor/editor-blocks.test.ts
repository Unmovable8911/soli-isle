// @vitest-environment happy-dom
import { Editor } from "@tiptap/core";
import { DragHandle } from "@tiptap/extension-drag-handle-react";
import { act, createElement, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { createSlashItems, type SlashItem } from "@/components/admin/slash-menu";
import { messages } from "@/messages";

import { articleExtensions } from "./extensions";

const labels = messages.en.admin.articles;
const items: SlashItem[] = createSlashItems(labels.slash, labels.editor, { onInsertImage: () => {} });

const editors: Editor[] = [];

/** `DragHandle` types `children` as a prop; the handle reads it as normal children. */
const Handle = DragHandle as unknown as (props: { editor: Editor }) => ReactNode;

/** The editor's own DOM, not the renderer's: this is what the Author types in. */
function createEditor(): Editor {
  const element = document.createElement("div");
  document.body.append(element);
  const editor = new Editor({
    element,
    extensions: articleExtensions,
    content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "/" }] }] },
  });
  editors.push(editor);
  return editor;
}

/** Runs a slash item over the `/` the Author typed, like the menu does. */
function runSlash(editor: Editor, key: string): void {
  const item = items.find((candidate) => candidate.key === key);
  if (item === undefined) {
    throw new Error(`no slash item ${key}`);
  }
  item.run({ editor, range: { from: 1, to: 2 } });
}

function nodeTypes(editor: Editor): string[] {
  const found: string[] = [];
  editor.state.doc.descendants((node) => {
    found.push(node.type.name);
    return true;
  });
  return found;
}

afterEach(() => {
  for (const editor of editors.splice(0)) {
    editor.destroy();
  }
  document.body.innerHTML = "";
});

describe("power blocks in the editor", () => {
  it("inserts a table from the slash menu", () => {
    const editor = createEditor();
    runSlash(editor, "table");

    expect(nodeTypes(editor)).toContain("table");
    expect(nodeTypes(editor).filter((name) => name === "tableRow")).toHaveLength(3);
  });

  it("offers the table controls only inside a table", () => {
    const editor = createEditor();
    const available = (key: string) =>
      items.find((candidate) => candidate.key === key)?.available?.(editor) ?? false;

    expect(available("addRow")).toBe(false);
    runSlash(editor, "table");
    expect(available("addRow")).toBe(true);
    expect(available("addColumn")).toBe(true);
    expect(available("deleteTable")).toBe(true);

    runSlash(editor, "addRow");
    expect(nodeTypes(editor).filter((name) => name === "tableRow")).toHaveLength(4);
    runSlash(editor, "deleteRow");
    expect(nodeTypes(editor).filter((name) => name === "tableRow")).toHaveLength(3);
  });

  it("inserts a callout around the block and keeps its tone", () => {
    const editor = createEditor();
    runSlash(editor, "callout");

    expect(editor.getJSON().content?.[0]).toMatchObject({
      type: "callout",
      attrs: { tone: "note" },
    });
    editor.commands.updateAttributes("callout", { tone: "warn" });
    expect(editor.getJSON().content?.[0]).toMatchObject({ attrs: { tone: "warn" } });
  });

  it("inserts a fold block that starts collapsed", () => {
    const editor = createEditor();
    runSlash(editor, "details");

    const fold = editor.getJSON().content?.[0];
    expect(fold?.type).toBe("details");
    expect(fold?.content?.map((child) => child.type)).toEqual(["detailsSummary", "detailsContent"]);
    expect(fold?.attrs?.open).toBeUndefined();
  });

  it("inserts inline and block formulas", () => {
    const editor = createEditor();
    window.prompt = () => "x^2";

    runSlash(editor, "mathBlock");
    expect(editor.getJSON().content?.[0]).toMatchObject({
      type: "blockMath",
      attrs: { latex: "x^2" },
    });

    const inline = createEditor();
    runSlash(inline, "mathInline");
    expect(nodeTypes(inline)).toContain("inlineMath");
  });

  it("inserts a footnote reference together with its note", () => {
    const editor = createEditor();
    runSlash(editor, "footnote");

    const [paragraph, section] = editor.getJSON().content ?? [];
    expect(paragraph?.content?.map((node) => node.type)).toContain("footnoteRef");
    expect(section?.type).toBe("footnoteSection");
    expect(section?.content?.[0]).toMatchObject({
      type: "footnoteItem",
      attrs: { label: "1" },
    });
  });

  it("numbers each new footnote after the highest one", () => {
    const editor = createEditor();
    runSlash(editor, "footnote");
    editor.commands.setTextSelection(editor.state.doc.content.size - 1);
    runSlash(editor, "footnote");

    const labelsOf = (json: ReturnType<Editor["getJSON"]>): string[] => {
      const found: string[] = [];
      const walk = (node: { type?: string; attrs?: Record<string, unknown>; content?: unknown[] }) => {
        if (node.type === "footnoteItem") {
          found.push(String(node.attrs?.label));
        }
        for (const child of (node.content ?? []) as typeof node[]) {
          walk(child);
        }
      };
      walk(json);
      return found;
    };

    expect(labelsOf(editor.getJSON())).toEqual(["1", "2"]);
  });
});

describe("undo and redo", () => {
  const cases: Array<[string, string]> = [
    ["table", "table"],
    ["callout", "callout"],
    ["details", "details"],
    ["mathBlock", "blockMath"],
    ["mathInline", "inlineMath"],
    ["footnote", "footnoteSection"],
  ];

  for (const [key, nodeType] of cases) {
    it(`covers ${key}`, () => {
      const editor = createEditor();
      window.prompt = () => "x^2";
      const before = editor.getJSON();

      runSlash(editor, key);
      const after = editor.getJSON();
      expect(JSON.stringify(after)).not.toBe(JSON.stringify(before));
      expect(nodeTypes(editor)).toContain(nodeType);

      editor.commands.undo();
      expect(editor.getJSON()).toEqual(before);

      editor.commands.redo();
      expect(editor.getJSON()).toEqual(after);
    });
  }

  it("undoes a footnote reference and its note in one step", () => {
    const editor = createEditor();
    const before = editor.getJSON();
    runSlash(editor, "footnote");
    expect(nodeTypes(editor)).toContain("footnoteSection");

    editor.commands.undo();
    expect(editor.getJSON()).toEqual(before);
  });
});

describe("drag to reorder", () => {
  it("attaches a block drag handle to the editor", async () => {
    const editor = createEditor();
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const runtime = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
    const previous = runtime.IS_REACT_ACT_ENVIRONMENT;
    runtime.IS_REACT_ACT_ENVIRONMENT = true;
    try {
      await act(async () => {
        root.render(createElement(Handle, { editor }, createElement("span", null, "grip")));
      });
      expect(document.querySelector(".drag-handle")).not.toBeNull();
      expect(document.body.textContent).toContain("grip");
    } finally {
      await act(async () => root.unmount());
      runtime.IS_REACT_ACT_ENVIRONMENT = previous;
    }
  });
});
