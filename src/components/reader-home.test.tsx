import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { messages } from "@/messages";
import type { ReaderArticleCard } from "@/services/reading";

import { HOME_GRID_LIMIT, HOME_HERO_LIMIT, ReaderHome } from "./reader-home";

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
    cover: null,
    tags: [],
    ...extra,
  };
}

/** Newest first, so index 8 is the first slide and index 1 is the last card. */
function newestFirst(count: number): ReaderArticleCard[] {
  return Array.from({ length: count }, (_, index) => article(count - index));
}

function heroOf(html: string): string {
  const start = html.indexOf('<section class="home-hero"');
  if (start === -1) {
    return "";
  }
  const end = html.indexOf("</section>", start);
  return html.slice(start, end);
}

function gridOf(html: string): string {
  const start = html.indexOf('<ul class="article-grid">');
  return start === -1 ? "" : html.slice(start);
}

function slidesOf(html: string): string[] {
  return heroOf(html).match(/class="home-hero-slide(?: [^"]*)?"/g) ?? [];
}

describe("the front page", () => {
  it("starts with the hero and keeps the page's name for assistive technology", () => {
    const html = renderToStaticMarkup(<ReaderHome articles={[article(1)]} locale="en" />);

    expect(html).toContain(`<h1 class="home-title">${t.chrome.siteName}</h1>`);
    expect(html).not.toContain("<h1><a");
    expect(html).not.toContain("home-masthead");
    expect(html).not.toContain("home-section-label");
    expect(html.indexOf("home-hero")).toBeGreaterThan(html.indexOf("</h1>"));
    // The shell already carries the section links; the front page does not repeat them.
    expect(html).not.toContain("reader-entries");
  });

  it("opens the hero with the newest five Articles, in that order", () => {
    const html = renderToStaticMarkup(<ReaderHome articles={newestFirst(8)} locale="en" />);
    const hero = heroOf(html);

    const positions = [8, 7, 6, 5, 4].map((index) => hero.indexOf(`>Article ${index}</a>`));
    expect(positions.every((position) => position > -1)).toBe(true);
    expect([...positions].sort((left, right) => left - right)).toEqual(positions);
  });

  it("keeps the hero Articles out of the grid and continues the list below it", () => {
    const html = renderToStaticMarkup(<ReaderHome articles={newestFirst(8)} locale="en" />);
    const hero = heroOf(html);
    const grid = gridOf(html);

    for (const index of [8, 7, 6, 5, 4]) {
      expect(hero).toContain(`Article ${index}`);
      expect(grid).not.toContain(`Article ${index}`);
    }
    expect(grid).toContain("Article 3");
    expect(grid).toContain("Article 2");
    expect(grid).toContain("Article 1");
  });

  it("caps the hero at five and the grid at twenty", () => {
    const many = newestFirst(HOME_HERO_LIMIT + HOME_GRID_LIMIT + 4);
    const html = renderToStaticMarkup(<ReaderHome articles={many} locale="en" />);

    expect(slidesOf(html)).toHaveLength(HOME_HERO_LIMIT);
    expect(gridOf(html).match(/<article class="article-card"/g)).toHaveLength(HOME_GRID_LIMIT);
  });

  it("labels every slide with its place in the carousel", () => {
    const html = renderToStaticMarkup(<ReaderHome articles={newestFirst(5)} locale="en" />);
    const hero = heroOf(html);

    expect(hero.match(/aria-roledescription="slide"/g)).toHaveLength(HOME_HERO_LIMIT);
    expect(hero).toContain('aria-label="Article 1 of 5"');
    expect(hero).toContain('aria-label="Article 5 of 5"');
  });

  it("shows the Category, title, two-line excerpt and date inside the hero", () => {
    const html = renderToStaticMarkup(<ReaderHome articles={[article(1)]} locale="en" />);
    const hero = heroOf(html);

    expect(hero).toContain("Notes");
    expect(hero).toContain("Article 1");
    expect(hero).toContain("Summary 1");
    expect(hero).toContain('dateTime="2025-06-15T08:30:00.000Z"');
    expect(hero).toContain("June 15, 2025");
    // The link is the title, never the whole slide.
    expect(hero).toContain('<a href="/en/articles/article-1">Article 1</a>');
  });

  it("gives the carousel its arrows, pause and dots, but not for a single Article", () => {
    const many = renderToStaticMarkup(<ReaderHome articles={newestFirst(3)} locale="en" />);
    const hero = heroOf(many);

    expect(hero).toContain('aria-label="Previous article"');
    expect(hero).toContain('aria-label="Next article"');
    expect(hero).toContain('aria-label="Pause the carousel"');
    expect(hero.match(/class="home-hero-dot(?: [^"]*)?"/g)).toHaveLength(3);
    expect(hero).toContain('aria-label="Show article 1"');
    expect(hero).toContain('aria-current="true"');

    const single = heroOf(
      renderToStaticMarkup(<ReaderHome articles={[article(1)]} locale="en" />),
    );
    expect(single).not.toContain("home-hero-arrow");
    expect(single).not.toContain("home-hero-pause");
    expect(single).not.toContain("home-hero-dot");
  });

  it("says one sentence and renders no grid when nothing is published", () => {
    const html = renderToStaticMarkup(<ReaderHome articles={[]} locale="en" />);

    expect(html).toContain(`<h1 class="home-title">${t.chrome.siteName}</h1>`);
    expect(html).toContain(t.reader.home.empty);
    expect(html).not.toContain("home-hero");
    expect(html).not.toContain("article-grid");
    expect(html).not.toContain("article-card");
  });

  it("shows no Post anywhere", () => {
    const html = renderToStaticMarkup(
      <ReaderHome
        articles={[
          article(2, {
            cover: { address: "/media/x/display.webp", width: 1600, height: 1000 },
          }),
          article(1),
        ]}
        locale="en"
      />,
    );

    expect(html).not.toContain("post-");
    expect(html).not.toContain("/posts/");
    expect(html).not.toContain("/feed");
  });

  it("designs a bare hero slide instead of leaving a gap where a cover would be", () => {
    const withoutCover = heroOf(
      renderToStaticMarkup(<ReaderHome articles={[article(1)]} locale="en" />),
    );
    const withCover = heroOf(
      renderToStaticMarkup(
        <ReaderHome
          articles={[
            article(1, {
              cover: { address: "/media/x/display.webp", width: 1600, height: 1000 },
            }),
          ]}
          locale="en"
        />,
      ),
    );

    expect(withoutCover).toContain("home-hero-slide--bare");
    expect(withoutCover).not.toContain("home-hero-image");
    expect(withCover).toContain("home-hero-image");
    expect(withCover).not.toContain("home-hero-slide--bare");
  });
});
