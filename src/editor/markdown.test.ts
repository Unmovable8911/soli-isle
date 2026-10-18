import type { JSONContent } from "@tiptap/core";
import { describe, expect, it } from "vitest";

import { deriveMarkdown, parseMarkdown } from "./markdown";

function document(content: JSONContent[]): string {
  return JSON.stringify({ type: "doc", content });
}

function text(value: string): JSONContent {
  return { type: "text", text: value };
}

function paragraph(...content: JSONContent[]): JSONContent {
  return { type: "paragraph", content };
}

/** The derived column is only truthful if it can be read back as the same body. */
function roundTrip(bodyJson: string): JSONContent {
  return parseMarkdown(deriveMarkdown(bodyJson));
}

describe("the derived Markdown column", () => {
  it("keeps a table as a pipe table", () => {
    const body = document([
      {
        type: "table",
        content: [
          {
            type: "tableRow",
            content: [
              { type: "tableHeader", content: [paragraph(text("metric"))] },
              { type: "tableHeader", content: [paragraph(text("value"))] },
            ],
          },
          {
            type: "tableRow",
            content: [
              { type: "tableCell", content: [paragraph(text("visits"))] },
              { type: "tableCell", content: [paragraph(text("42"))] },
            ],
          },
        ],
      },
    ]);

    const markdown = deriveMarkdown(body);
    expect(markdown).toContain("| metric | value |");
    expect(markdown).toContain("| visits | 42    |");
    expect(roundTrip(body)).toEqual(JSON.parse(body));
  });

  it("keeps inline and block math in their delimiters", () => {
    const body = document([
      { type: "blockMath", attrs: { latex: "x^2 + y^2" } },
      { type: "paragraph", content: [text("inline "), { type: "inlineMath", attrs: { latex: "a+b" } }] },
    ]);

    const markdown = deriveMarkdown(body);
    expect(markdown).toContain("$$\nx^2 + y^2\n$$");
    expect(markdown).toContain("$a+b$");
    expect(roundTrip(body)).toEqual(JSON.parse(body));
  });

  it("keeps a fold block with its summary and body", () => {
    const fold = {
      type: "details",
      content: [
        { type: "detailsSummary", content: [text("The long version")] },
        { type: "detailsContent", content: [paragraph(text("hidden body"))] },
      ],
    };
    const body = document([fold]);

    expect(roundTrip(body)).toEqual(JSON.parse(body));
  });

  it("keeps a callout as a toned admonition", () => {
    const body = document([{ type: "callout", attrs: { tone: "warn" }, content: [paragraph(text("watch out"))] }]);

    const markdown = deriveMarkdown(body);
    expect(markdown).toContain("> [!warn]");
    expect(markdown).toContain("> watch out");
    expect(roundTrip(body)).toEqual(JSON.parse(body));
  });

  it("keeps a footnote reference and its note", () => {
    const cited = document([
      paragraph(text("Cited"), { type: "footnoteRef", attrs: { label: "1" } }, text(" here.")),
      {
        type: "footnoteSection",
        content: [
          { type: "footnoteItem", attrs: { label: "1" }, content: [paragraph(text("the note"))] },
        ],
      },
    ]);

    const markdown = deriveMarkdown(cited);
    expect(markdown).toContain("[^1]");
    expect(markdown).not.toContain("\\[^1\\]");
    expect(markdown).toContain("[^1]: the note");
    expect(roundTrip(cited)).toEqual(JSON.parse(cited));
  });

  it("keeps several footnotes and their order", () => {
    const cited = document([
      paragraph(
        text("First"),
        { type: "footnoteRef", attrs: { label: "1" } },
        text(" and second"),
        { type: "footnoteRef", attrs: { label: "2" } },
      ),
      {
        type: "footnoteSection",
        content: [
          { type: "footnoteItem", attrs: { label: "1" }, content: [paragraph(text("one"))] },
          { type: "footnoteItem", attrs: { label: "2" }, content: [paragraph(text("two"))] },
        ],
      },
    ]);

    expect(roundTrip(cited)).toEqual(JSON.parse(cited));
  });
});
