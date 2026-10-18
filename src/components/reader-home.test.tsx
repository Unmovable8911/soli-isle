import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { messages } from "@/messages";
import type { ReaderArticleCard } from "@/services/reading";

import { HOME_GRID_LIMIT, ReaderHome } from "./reader-home";

const t = messages.en;

/** Newest first, exactly as listRecentArticles hands them over. */
function article(index: number, extra: Partial<ReaderArticleCard> = {}): ReaderArticleCard {
  return {
    id: `article-${index}`,
    slug: `article-${index}`,
    title: `Article ${index}`,
    summary: `Summary ${index}`,
    publishTime: "2025-06-15T08:30:00.000Z",
    category: { slug: "notes", path: "notes", name: "Notes" },
    tags: [],
    ...extra,
  };
}

function gridOf(html: string): string {
  const start = html.indexOf('<ul class="article-grid">');
  return start === -1 ? "" : html.slice(start);
}

describe("the front page", () => {
  it("opens with the wordmark and one sentence, and the wordmark is not a link", () => {
    const html = renderToStaticMarkup(<ReaderHome articles={[article(1)]} locale="en" />);

    expect(html).toContain(`<h1>${t.chrome.siteName}</h1>`);
    expect(html).toContain(t.reader.home.lead);
    expect(html).not.toContain("<h1><a");
    // The rail already carries the section links; the front page does not repeat them.
    expect(html).not.toContain("reader-entries");
  });

  it("leads with the newest Article and keeps it out of the grid", () => {
    const html = renderToStaticMarkup(
      <ReaderHome articles={[article(3), article(2), article(1)]} locale="en" />,
    );

    const lead = html.indexOf("Article 3");
    expect(lead).toBeGreaterThan(-1);
    expect(lead).toBeLessThan(html.indexOf("Article 2"));
    expect(gridOf(html)).not.toContain("Article 3");
    expect(gridOf(html)).toContain("Article 2");
    expect(gridOf(html)).toContain("Article 1");
  });

  it("caps the grid at twenty Articles", () => {
    const many = Array.from({ length: HOME_GRID_LIMIT + 5 }, (_, index) => article(index));
    const html = renderToStaticMarkup(<ReaderHome articles={many} locale="en" />);

    expect(gridOf(html).match(/<article class="article-card"/g)).toHaveLength(HOME_GRID_LIMIT);
  });

  it("says one sentence and renders no grid when nothing is published", () => {
    const html = renderToStaticMarkup(<ReaderHome articles={[]} locale="en" />);

    expect(html).toContain(`<h1>${t.chrome.siteName}</h1>`);
    expect(html).toContain(t.reader.home.empty);
    expect(html).not.toContain("article-grid");
    expect(html).not.toContain("article-card");
  });

  it("shows no Post anywhere", () => {
    const html = renderToStaticMarkup(
      <ReaderHome articles={[article(2, { cover: { address: "/media/x/display.webp", width: 1600, height: 1000 } }), article(1)]} locale="en" />,
    );

    expect(html).not.toContain("post-");
    expect(html).not.toContain("/posts/");
    expect(html).not.toContain("/feed");
  });

  it("splits the lead only when it has a cover to sit beside the text", () => {
    const withoutCover = renderToStaticMarkup(<ReaderHome articles={[article(1)]} locale="en" />);
    const withCover = renderToStaticMarkup(
      <ReaderHome
        articles={[article(1, { cover: { address: "/media/x/display.webp", width: 1600, height: 1000 } })]}
        locale="en"
      />,
    );

    expect(withoutCover).toContain('class="article-card article-lead"');
    expect(withCover).toContain('class="article-card article-lead article-lead--split"');
  });
});
