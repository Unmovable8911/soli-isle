import { describe, expect, it } from "vitest";

import { EMPTY_DOCUMENT, isRichTextDocument, richTextDocumentOrEmpty } from "./rich-text";

describe("rich text documents", () => {
  it("accepts a ProseMirror document", () => {
    expect(isRichTextDocument('{"type":"doc","content":[]}')).toBe(true);
    expect(isRichTextDocument(EMPTY_DOCUMENT)).toBe(true);
  });

  it("rejects malformed JSON", () => {
    expect(isRichTextDocument("{")).toBe(false);
    expect(isRichTextDocument("not json")).toBe(false);
  });

  it("rejects JSON that is not a ProseMirror document", () => {
    expect(isRichTextDocument("[]")).toBe(false);
    expect(isRichTextDocument('{"type":"paragraph"}')).toBe(false);
    expect(isRichTextDocument('"doc"')).toBe(false);
  });

  it("treats the empty working document as a document", () => {
    expect(JSON.parse(EMPTY_DOCUMENT)).toEqual({
      type: "doc",
      content: [{ type: "paragraph" }],
    });
  });

  it("falls back to the empty document when the stored body is unusable", () => {
    expect(richTextDocumentOrEmpty("{")).toBe(EMPTY_DOCUMENT);
    expect(richTextDocumentOrEmpty('{"type":"doc","content":[]}')).toBe('{"type":"doc","content":[]}');
  });
});
