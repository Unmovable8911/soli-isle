import { describe, expect, it } from "vitest";

import { reconcileArticleEdit, type LocalArticleEdit, type ServerArticleState } from "./article-sync";

const BODY = '{"type":"doc","content":[{"type":"paragraph"}]}';

function local(overrides: Partial<LocalArticleEdit> = {}): LocalArticleEdit {
  return { baseVersion: 4, title: "Draft", summary: "Notes", bodyJson: BODY, ...overrides };
}

function server(overrides: Partial<ServerArticleState> = {}): ServerArticleState {
  return { version: 4, title: "Draft", summary: "Notes", bodyJson: BODY, ...overrides };
}

describe("reconcileArticleEdit", () => {
  it("pushes when the local copy is derived from the current server version and differs", () => {
    const edited = '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Hi"}]}]}';
    expect(reconcileArticleEdit(local({ bodyJson: edited }), server())).toBe("push");
  });

  it("reports in-sync when the two copies already hold the same content at the same version", () => {
    expect(reconcileArticleEdit(local(), server())).toBe("in-sync");
  });

  it("refuses to push when the server version moved on and the content differs", () => {
    expect(reconcileArticleEdit(local({ title: "Mine" }), server({ version: 5 }))).toBe("conflict");
  });

  it("reports in-sync when the server moved on but already holds exactly this content", () => {
    expect(reconcileArticleEdit(local(), server({ version: 9 }))).toBe("in-sync");
  });

  it("refuses to push when the local base version is ahead of the server version", () => {
    expect(reconcileArticleEdit(local({ title: "Mine" }), server({ version: 3 }))).toBe("conflict");
  });

  it("does not treat a whitespace-only title difference as in-sync", () => {
    expect(reconcileArticleEdit(local({ title: "Draft " }), server())).toBe("push");
  });

  it("treats a reformatted document with the same nodes as the same content", () => {
    const reformatted = '{\n  "type": "doc",\n  "content": [{ "type": "paragraph" }]\n}';
    expect(reconcileArticleEdit(local({ bodyJson: reformatted }), server({ version: 7 }))).toBe(
      "in-sync",
    );
  });

  it("compares documents with different nodes as different content", () => {
    const other = '{"type":"doc","content":[{"type":"heading"}]}';
    expect(reconcileArticleEdit(local({ bodyJson: other }), server())).toBe("push");
  });

  it("falls back to a literal comparison when a body is not valid JSON", () => {
    expect(reconcileArticleEdit(local({ bodyJson: "not json" }), server({ bodyJson: "not json" }))).toBe(
      "in-sync",
    );
    expect(reconcileArticleEdit(local({ bodyJson: "not json" }), server({ bodyJson: "NOT JSON" }))).toBe(
      "push",
    );
  });

  it("reports in-sync when both sides are blank at different versions", () => {
    const blank = { title: "", summary: "", bodyJson: "" };
    expect(reconcileArticleEdit(local({ ...blank, baseVersion: 1 }), server({ ...blank, version: 2 }))).toBe(
      "in-sync",
    );
  });

  it("pushes when only the summary differs", () => {
    expect(reconcileArticleEdit(local({ summary: "Other notes" }), server())).toBe("push");
  });

  it("pushes when the title differs even if the documents are equivalent", () => {
    const reformatted = '{"type":"doc","content":[{"type":"paragraph"}]}';
    expect(reconcileArticleEdit(local({ title: "Mine", bodyJson: reformatted }), server())).toBe(
      "push",
    );
  });
});
