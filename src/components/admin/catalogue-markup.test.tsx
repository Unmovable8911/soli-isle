import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { messages } from "@/messages";
import type { CategoryNode } from "@/services/categories";
import type { TagView } from "@/services/tags";

import { CategoryTree, flattenCategories, forbiddenParents } from "./category-manager";
import { TagTable } from "./tag-manager";

const labels = messages.zh.admin.categories;
const localeNames = messages.zh.chrome.localeNames;

const TREE: CategoryNode[] = [
  {
    id: "01NOTES",
    parentId: null,
    slug: "notes",
    path: "notes",
    position: 0,
    names: { zh: "手记", en: "Notes" },
    children: [
      {
        id: "01TOOLS",
        parentId: "01NOTES",
        slug: "tools",
        path: "notes/tools",
        position: 0,
        names: { zh: "工具" },
        children: [],
      },
    ],
  },
  {
    id: "01ESSAYS",
    parentId: null,
    slug: "essays",
    path: "essays",
    position: 1,
    names: {},
    children: [],
  },
];

function renderTree(): string {
  return renderToStaticMarkup(
    <CategoryTree
      tree={TREE}
      locale="zh"
      labels={labels}
      localeNames={localeNames}
      flat={flattenCategories(TREE)}
      busy={false}
      onPatch={() => Promise.resolve(true)}
      onDelete={() => undefined}
    />,
  );
}

describe("category tree markup", () => {
  it("nests a child list inside its parent instead of flattening the tree", () => {
    const html = renderTree();

    // A flat list would be one <ul> with three <li>; the tree is a root list
    // plus a child list that opens inside the parent's own <li>.
    expect(html.match(/<li class="category-node">/g)).toHaveLength(3);
    expect(html.match(/<ul class="category-tree">/g)).toHaveLength(2);

    const parent = html.indexOf("手记");
    const nestedList = html.indexOf('<ul class="category-tree">', parent);
    const child = html.indexOf("工具");
    expect(parent).toBeGreaterThan(-1);
    expect(nestedList).toBeGreaterThan(parent);
    expect(child).toBeGreaterThan(nestedList);
  });

  it("shows the locale-neutral path as well as the display name", () => {
    const html = renderTree();

    expect(html).toContain("<code class=\"category-node-path\">notes/tools</code>");
    // A Category with no name in the Author's Locale falls back to its Slug.
    expect(html).toContain("essays");
  });

  it("offers a name input per Site Locale and a save control for each", () => {
    const html = renderTree();

    for (const locale of ["zh", "en"] as const) {
      expect(html).toContain(`显示名 · ${localeNames[locale]}`);
    }
    expect(html.match(/>保存</g)?.length).toBeGreaterThanOrEqual(4);
  });

  it("keeps every operation on a real form control so the keyboard can reach it", () => {
    const html = renderTree();

    // A parent select plus a move button, ordering buttons, and a delete button.
    expect(html).toContain(`>${labels.node.parent}</label>`);
    expect(html).toContain(`>${labels.node.move}</button>`);
    expect(html).toContain(`>${labels.node.up}</button>`);
    expect(html).toContain(`>${labels.node.down}</button>`);
    expect(html).toContain(`>${labels.node.delete}</button>`);
    expect(html).not.toContain("draggable");
    // No operation hides behind a hover-only affordance.
    expect(html).not.toContain("onmouseover");
  });

  it("does not offer a Category as its own parent, nor one of its own children", () => {
    const html = renderTree();
    const notesEditor = html.slice(html.indexOf("手记"), html.indexOf("工具"));

    expect(notesEditor).toContain('<option value="01ESSAYS">essays</option>');
    expect(notesEditor).not.toContain('<option value="01NOTES"');
    expect(notesEditor).not.toContain('<option value="01TOOLS"');
  });
});

describe("forbidden parents", () => {
  it("names the category itself and every one of its descendants", () => {
    expect([...forbiddenParents(TREE[0] as CategoryNode)]).toEqual(["01NOTES", "01TOOLS"]);
    expect([...forbiddenParents(TREE[1] as CategoryNode)]).toEqual(["01ESSAYS"]);
  });
});

describe("category flattening", () => {
  it("lists a parent before its children, with depth", () => {
    expect(flattenCategories(TREE)).toEqual([
      { id: "01NOTES", path: "notes", depth: 0 },
      { id: "01TOOLS", path: "notes/tools", depth: 1 },
      { id: "01ESSAYS", path: "essays", depth: 0 },
    ]);
  });
});

const TAGS: TagView[] = [
  { id: "01EDITOR", slug: "editor", names: { zh: "编辑器" } },
  { id: "01SOLO", slug: "solo", names: {} },
];

describe("tag table markup", () => {
  const tagLabels = messages.zh.admin.tags;

  function renderTags(): string {
    return renderToStaticMarkup(
      <TagTable
        tags={TAGS}
        labels={tagLabels}
        localeNames={localeNames}
        busy={false}
        onSave={() => undefined}
        onDelete={() => undefined}
      />,
    );
  }

  it("shows the Slug and a name input per Site Locale", () => {
    const html = renderTags();

    expect(html).toContain("<code>editor</code>");
    expect(html).toContain("<code>solo</code>");
    for (const locale of ["zh", "en"] as const) {
      expect(html).toContain(`>${localeNames[locale]}</label>`);
    }
    expect(html.match(/>保存</g)).toHaveLength(TAGS.length * 2);
  });

  it("prefills the name it has and leaves the rest to the Slug placeholder", () => {
    const html = renderTags();

    expect(html).toContain('value="编辑器"');
    // A Locale with no name yet shows the Slug, which is not a stored name.
    expect(html).toContain('placeholder="solo"');
  });

  it("offers delete on a real button", () => {
    const html = renderTags();

    expect(html.match(new RegExp(`>${tagLabels.delete}</button>`, "g"))).toHaveLength(TAGS.length);
  });
});
