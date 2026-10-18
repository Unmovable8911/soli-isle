import { describe, expect, it } from "vitest";

import { articleHeadings } from "@/domain/table-of-contents";

import { renderArticleBody } from "./render-article";

const ASSET_ID = "3f4b1c9e-5f0a-4b8b-9d3a-4f6a1c2b3d4e";

function doc(content: unknown[]): string {
  return JSON.stringify({ type: "doc", content });
}

function heading(level: number, text: string): unknown {
  return { type: "heading", attrs: { level }, content: [{ type: "text", text }] };
}

describe("article body rendering", () => {
  it("renders the core block set", async () => {
    const html = await renderArticleBody(
      doc([
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Title" }] },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "plain " },
            { type: "text", text: "bold", marks: [{ type: "bold" }] },
            { type: "text", text: " and " },
            { type: "text", text: "marked", marks: [{ type: "highlight" }] },
          ],
        },
        {
          type: "bulletList",
          content: [
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "item" }] }] },
          ],
        },
        { type: "blockquote", content: [{ type: "paragraph", content: [{ type: "text", text: "quote" }] }] },
        { type: "horizontalRule" },
        {
          type: "taskList",
          content: [
            {
              type: "taskItem",
              attrs: { checked: true },
              content: [{ type: "paragraph", content: [{ type: "text", text: "done" }] }],
            },
          ],
        },
      ]),
    );

    expect(html).toContain('<h2 id="title">Title</h2>');
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<mark>marked</mark>");
    expect(html).toContain("<ul>");
    expect(html).toContain("<blockquote>");
    expect(html).toContain("<hr/>");
    expect(html).toContain('data-type="taskList"');
  });

  it("gives every heading the anchor the table of contents links to", async () => {
    const body = doc([
      heading(2, "Overview"),
      heading(3, "Details"),
      heading(4, "Aside"),
      heading(2, "Overview"),
    ]);

    const html = await renderArticleBody(body);

    // One function decides both: a link is only useful if it lands on the id
    // the heading actually renders, so the two are checked against each other.
    expect(articleHeadings(body).map((entry) => entry.id)).toEqual(["overview", "details", "overview-2"]);
    expect(html).toContain('<h2 id="overview">Overview</h2>');
    expect(html).toContain('<h3 id="details">Details</h3>');
    expect(html).toContain('<h4 id="aside">Aside</h4>');
    expect(html).toContain('<h2 id="overview-2">Overview</h2>');
  });

  it("highlights a code block and keeps its language", async () => {
    const html = await renderArticleBody(
      doc([
        {
          type: "codeBlock",
          attrs: { language: "typescript" },
          content: [{ type: "text", text: "const answer = 42;" }],
        },
      ]),
    );

    expect(html).toContain('class="shiki');
    expect(html).toContain("answer");
  });

  it("renders a code block with an unknown language instead of failing", async () => {
    const html = await renderArticleBody(
      doc([
        {
          type: "codeBlock",
          attrs: { language: "cobol" },
          content: [{ type: "text", text: "MOVE 1 TO X." }],
        },
      ]),
    );

    expect(html).toContain("MOVE 1 TO X.");
  });

  it("derives a responsive srcset from the stored asset address", async () => {
    const html = await renderArticleBody(
      doc([
        {
          type: "image",
          attrs: { src: `/media/${ASSET_ID}/display.webp`, alt: "a hero", width: 1600, height: 900 },
        },
      ]),
    );

    expect(html).toContain(`src="/media/${ASSET_ID}/display.webp"`);
    expect(html).toContain(
      `srcset="/media/${ASSET_ID}/display.webp 1600w, /media/${ASSET_ID}/thumb.webp 800w"`,
    );
    expect(html).toContain('alt="a hero"');
    expect(html).toContain('loading="lazy"');
    expect(html).toContain('width="1600"');
  });

  it("leaves an image without a media address alone", async () => {
    const html = await renderArticleBody(
      doc([{ type: "image", attrs: { src: "https://example.com/x.png", alt: "" } }]),
    );

    expect(html).toContain('src="https://example.com/x.png"');
    expect(html).not.toContain("srcset");
  });

  it("renders nothing for a body that is not a ProseMirror document", async () => {
    await expect(renderArticleBody("{")).resolves.toBe("");
    await expect(renderArticleBody('{"type":"paragraph"}')).resolves.toBe("");
  });
});

describe("body images on the Reader page", () => {
  const tall = { original: `/media/${ASSET_ID}/original.png`, width: 900, height: 4000 };

  function imageBody(): string {
    return doc([{ type: "image", attrs: { src: `/media/${ASSET_ID}/display.webp`, alt: "chart" } }]);
  }

  it("emits the untouched original and the stored dimensions", async () => {
    const html = await renderArticleBody(imageBody(), { resolveImage: () => tall });

    expect(html).toContain(`data-original="/media/${ASSET_ID}/original.png"`);
    expect(html).toContain('width="900"');
    expect(html).toContain('height="4000"');
    expect(html).toContain(`srcset="/media/${ASSET_ID}/display.webp 1600w, /media/${ASSET_ID}/thumb.webp 800w"`);
  });

  it("marks an extremely tall image so CSS can contain it by viewport height", async () => {
    const html = await renderArticleBody(imageBody(), { resolveImage: () => tall });

    expect(html).toContain('class="article-image article-image--tall"');
  });

  it("leaves an ordinary aspect ratio at its original proportions", async () => {
    const html = await renderArticleBody(imageBody(), {
      resolveImage: () => ({ original: "/x.png", width: 1600, height: 900 }),
    });

    expect(html).toContain('class="article-image"');
    expect(html).not.toContain("article-image--tall");
  });

  it("still renders an image whose Asset cannot be resolved", async () => {
    const html = await renderArticleBody(imageBody(), { resolveImage: () => null });

    expect(html).toContain(`src="/media/${ASSET_ID}/display.webp"`);
    expect(html).toContain('class="article-image"');
    expect(html).not.toContain("data-original");
  });
});

describe("power blocks on the published page", () => {
  it("renders math as KaTeX instead of the extension's marker element", async () => {
    const html = await renderArticleBody(
      doc([
        { type: "blockMath", attrs: { latex: "x^2 + y^2" } },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "inline " },
            { type: "inlineMath", attrs: { latex: "a+b" } },
          ],
        },
      ]),
    );

    expect(html).toContain('class="katex"');
    expect(html).toContain("katex-display");
    expect(html).not.toContain("data-type=\"block-math\"");
    expect(html).not.toContain("data-type=\"inline-math\"");
  });

  it("renders a table as a semantic table", async () => {
    const html = await renderArticleBody(
      doc([
        {
          type: "table",
          content: [
            {
              type: "tableRow",
              content: [
                { type: "tableHeader", content: [{ type: "paragraph", content: [{ type: "text", text: "metric" }] }] },
                { type: "tableHeader", content: [{ type: "paragraph", content: [{ type: "text", text: "value" }] }] },
              ],
            },
            {
              type: "tableRow",
              content: [
                { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "visits" }] }] },
                { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "42" }] }] },
              ],
            },
          ],
        },
      ]),
    );

    expect(html).toContain("<table");
    expect(html).toContain("<th><p>metric</p></th>");
    expect(html).toContain("<td><p>42</p></td>");
  });

  it("renders a callout with its tone and body", async () => {
    const html = await renderArticleBody(
      doc([
        {
          type: "callout",
          attrs: { tone: "warn" },
          content: [{ type: "paragraph", content: [{ type: "text", text: "watch out" }] }],
        },
      ]),
    );

    expect(html).toContain('data-type="callout"');
    expect(html).toContain('data-tone="warn"');
    expect(html).toContain('class="callout-body"');
    expect(html).toContain("<p>watch out</p>");
  });

  it("renders a fold block collapsed, with its summary and body", async () => {
    const html = await renderArticleBody(
      doc([
        {
          type: "details",
          content: [
            { type: "detailsSummary", content: [{ type: "text", text: "The long version" }] },
            {
              type: "detailsContent",
              content: [{ type: "paragraph", content: [{ type: "text", text: "hidden body" }] }],
            },
          ],
        },
      ]),
    );

    expect(html).toContain("<details>");
    expect(html).toContain("<summary>The long version</summary>");
    expect(html).toContain("hidden body");
    expect(html).not.toContain("open=");
  });

  it("renders footnotes as a list with back-links", async () => {
    const html = await renderArticleBody(
      doc([
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Cited" },
            { type: "footnoteRef", attrs: { label: "2" } },
            { type: "text", text: " here." },
          ],
        },
        {
          type: "footnoteSection",
          content: [
            {
              type: "footnoteItem",
              attrs: { label: "2" },
              content: [{ type: "paragraph", content: [{ type: "text", text: "the note" }] }],
            },
          ],
        },
      ]),
    );

    expect(html).toContain('class="footnotes"');
    expect(html).toContain("<ol");
    expect(html).toContain('id="fn-2"');
    expect(html).toContain('data-label="2"');
    expect(html).toContain('id="fnref-2"');
    expect(html).toContain("the note");
    expect(html).toContain('href="#fnref-2"');
  });
});
