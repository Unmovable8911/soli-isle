import { describe, expect, it } from "vitest";

import { articleHeadings, buildTableOfContents, TOC_MIN_HEADINGS } from "./table-of-contents";

function doc(content: unknown[]): string {
  return JSON.stringify({ type: "doc", content });
}

function heading(level: number, text: string): unknown {
  return { type: "heading", attrs: { level }, content: [{ type: "text", text }] };
}

function paragraph(text: string): unknown {
  return { type: "paragraph", content: [{ type: "text", text }] };
}

describe("the table of contents", () => {
  it("stays out of a short Article's way", () => {
    const short = doc([heading(2, "One"), paragraph("text"), heading(2, "Two")]);
    expect(buildTableOfContents(short)).toEqual([]);
    expect(TOC_MIN_HEADINGS).toBe(3);
  });

  it("appears once the body carries three h2", () => {
    const long = doc([heading(2, "One"), paragraph("text"), heading(2, "Two"), heading(2, "Three")]);
    expect(buildTableOfContents(long).map((entry) => entry.text)).toEqual(["One", "Two", "Three"]);
  });

  it("lists h2 and h3 in document order and leaves h4 out", () => {
    const body = doc([
      heading(2, "First"),
      paragraph("text"),
      heading(3, "Detail"),
      heading(4, "Aside"),
      heading(2, "Second"),
      heading(3, "Another detail"),
      heading(2, "Third"),
    ]);

    expect(buildTableOfContents(body)).toEqual([
      { id: "first", level: 2, text: "First" },
      { id: "detail", level: 3, text: "Detail" },
      { id: "second", level: 2, text: "Second" },
      { id: "another-detail", level: 3, text: "Another detail" },
      { id: "third", level: 2, text: "Third" },
    ]);
  });

  it("counts repeats so the same JSON always yields the same anchors", () => {
    const body = doc([heading(2, "Overview"), heading(2, "Overview"), heading(2, "Overview")]);

    const once = buildTableOfContents(body);
    expect(once.map((entry) => entry.id)).toEqual(["overview", "overview-2", "overview-3"]);
    expect(buildTableOfContents(body)).toEqual(once);
  });

  it("numbers every heading level, so an h4 cannot shift an h2's anchor", () => {
    const body = doc([
      heading(2, "Alpha"),
      heading(4, "Alpha"),
      heading(2, "Beta"),
      heading(2, "Gamma"),
      heading(2, "Alpha"),
    ]);

    expect(articleHeadings(body).map((entry) => entry.id)).toEqual(["alpha", "beta", "gamma", "alpha-3"]);
  });

  it("keeps a Chinese heading addressable", () => {
    const body = doc([heading(2, "第一章 缘起"), heading(2, "第二章 转折"), heading(2, "第三章 归途")]);

    expect(buildTableOfContents(body).map((entry) => entry.id)).toEqual([
      "第一章-缘起",
      "第二章-转折",
      "第三章-归途",
    ]);
  });

  it("still finds an anchor for a heading that is all punctuation", () => {
    const body = doc([heading(2, "***"), heading(2, "---"), heading(2, "?!?")]);

    const ids = buildTableOfContents(body).map((entry) => entry.id);
    expect(ids).toEqual(["section", "section-2", "section-3"]);
    expect(new Set(ids).size).toBe(3);
  });

  it("gives a body that is not a ProseMirror document no table", () => {
    expect(buildTableOfContents("{")).toEqual([]);
    expect(buildTableOfContents('{"type":"paragraph"}')).toEqual([]);
    expect(buildTableOfContents(JSON.stringify({ type: "doc", content: [] }))).toEqual([]);
  });
});
