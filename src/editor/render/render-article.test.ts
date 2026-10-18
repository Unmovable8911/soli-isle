import { describe, expect, it } from "vitest";

import { renderArticleBody } from "./render-article";

const ASSET_ID = "3f4b1c9e-5f0a-4b8b-9d3a-4f6a1c2b3d4e";

function doc(content: unknown[]): string {
  return JSON.stringify({ type: "doc", content });
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

    expect(html).toContain("<h2>Title</h2>");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<mark>marked</mark>");
    expect(html).toContain("<ul>");
    expect(html).toContain("<blockquote>");
    expect(html).toContain("<hr/>");
    expect(html).toContain('data-type="taskList"');
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
