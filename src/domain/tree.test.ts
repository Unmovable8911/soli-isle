import { describe, expect, it } from "vitest";

import { flattenTree } from "./tree";

interface Node {
  name: string;
  children: Node[];
}

const TREE: Node[] = [
  {
    name: "notes",
    children: [
      { name: "tools", children: [{ name: "editors", children: [] }] },
      { name: "life", children: [] },
    ],
  },
  { name: "work", children: [] },
];

describe("flatten tree", () => {
  it("walks depth-first and reports the depth of each node", () => {
    expect(flattenTree(TREE).map((entry) => [entry.node.name, entry.depth])).toEqual([
      ["notes", 0],
      ["tools", 1],
      ["editors", 2],
      ["life", 1],
      ["work", 0],
    ]);
  });

  it("has nothing to flatten for an empty tree", () => {
    expect(flattenTree([])).toEqual([]);
  });
});
