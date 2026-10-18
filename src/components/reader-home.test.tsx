import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { buildHomeListingPath } from "@/domain/public-paths";
import { messages } from "@/messages";
import type { ReaderArticleCard, ReaderCategoryNode } from "@/services/reading";

import { HOME_HERO_LIMIT, HOME_PAGE_SIZE, ReaderHome } from "./reader-home";

const t = messages.en;
const home = t.reader.home;

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

function category(
  path: string,
  name: string,
  count: number,
  children: ReaderCategoryNode[] = [],
): ReaderCategoryNode {
  return {
    id: `category-${path}`,
    slug: path.slice(path.lastIndexOf("/") + 1),
    path,
    name,
    count,
    children,
  };
}

/** The two top-level Categories the front page offers. */
const NOTES = category("notes", "Notes", 37, [category("notes/tools", "Tools", 5)]);
const ESSAYS = category("essays", "Essays", 11);
const CATEGORIES = [NOTES, ESSAYS];

function renderHome({
  articles,
  categories = CATEGORIES,
  categoryPath = null,
  page = 1,
}: {
  articles: readonly ReaderArticleCard[];
  categories?: readonly ReaderCategoryNode[];
  categoryPath?: string | null;
  page?: number;
}): string {
  return renderToStaticMarkup(
    <ReaderHome
      articles={articles}
      categories={categories}
      locale="en"
      categoryPath={categoryPath}
      page={page}
    />,
  );
}

/** The markup React writes for a URL: an ampersand is escaped in the attribute. */
function attribute(url: string): string {
  return `href="${url.replaceAll("&", "&amp;")}"`;
}

/** The anchor for a URL, whatever order its other attributes come in. */
function anchorOf(html: string, url: string): string {
  const at = html.indexOf(attribute(url));
  if (at === -1) {
    return "";
  }
  const start = html.lastIndexOf("<a ", at);
  const end = html.indexOf("</a>", at);
  return start === -1 || end === -1 ? "" : html.slice(start, end + 4);
}

function navOf(html: string, className: string): string {
  const start = html.indexOf(`<nav class="${className}"`);
  if (start === -1) {
    return "";
  }
  const end = html.indexOf("</nav>", start);
  return end === -1 ? html.slice(start) : html.slice(start, end);
}

function filterOf(html: string): string {
  return navOf(html, "home-filter");
}

function paginatorOf(html: string): string {
  return navOf(html, "home-pagination");
}

function heroOf(html: string): string {
  const start = html.indexOf('<section class="home-hero"');
  if (start === -1) {
    return "";
  }
  const end = html.indexOf("</section>", start);
  return html.slice(start, end);
}

/** The grid alone: the hero above it and the pages below it are not cards. */
function gridOf(html: string): string {
  const start = html.indexOf('<ul class="article-grid">');
  if (start === -1) {
    return "";
  }
  const end = html.indexOf('<nav class="home-pagination"', start);
  return html.slice(start, end === -1 ? undefined : end);
}

function cardsOf(html: string): number {
  return (html.match(/<article class="article-card"/g) ?? []).length;
}

function slidesOf(html: string): string[] {
  return heroOf(html).match(/class="home-hero-slide(?: [^"]*)?"/g) ?? [];
}

/** The number on the page link the Reader is looking at. */
function currentPageOf(html: string): string | undefined {
  return /<a [^>]*aria-current="page"[^>]*>(\d+)<\/a>/.exec(paginatorOf(html))?.[1];
}

describe("the front page", () => {
  it("starts with the hero and keeps the page's name for assistive technology", () => {
    const html = renderHome({ articles: [article(1)] });

    expect(html).toContain(`<h1 class="home-title">${t.chrome.siteName}</h1>`);
    expect(html).not.toContain("<h1><a");
    expect(html).not.toContain("home-masthead");
    expect(html).not.toContain("home-section-label");
    expect(html.indexOf("home-hero")).toBeGreaterThan(html.indexOf("</h1>"));
    // The shell already carries the section links; the front page does not repeat them.
    expect(html).not.toContain("reader-entries");
  });

  it("reads down as hero, filter, grid, then pages", () => {
    const html = renderHome({ articles: newestFirst(30) });
    const markers = ["home-hero", "home-filter", "article-grid", "home-pagination"].map((marker) =>
      html.indexOf(marker),
    );

    expect(markers.every((position) => position > -1)).toBe(true);
    expect([...markers].sort((left, right) => left - right)).toEqual(markers);
  });

  it("opens the hero with the newest five Articles, in that order", () => {
    const hero = heroOf(renderHome({ articles: newestFirst(8) }));

    const positions = [8, 7, 6, 5, 4].map((index) => hero.indexOf(`>Article ${index}</a>`));
    expect(positions.every((position) => position > -1)).toBe(true);
    expect([...positions].sort((left, right) => left - right)).toEqual(positions);
  });

  it("shows every Article in the grid, the hero's five included", () => {
    const html = renderHome({ articles: newestFirst(8) });
    const hero = heroOf(html);
    const grid = gridOf(html);

    // The hero is a highlight of the newest five, not a second listing that
    // takes them out of the grid below it.
    for (const index of [8, 7, 6, 5, 4]) {
      expect(hero).toContain(`Article ${index}`);
      expect(grid).toContain(`Article ${index}`);
    }
    expect(grid).toContain("Article 1");
  });

  it("caps the hero at five and the listing at twelve a page", () => {
    const html = renderHome({ articles: newestFirst(30) });

    expect(HOME_PAGE_SIZE).toBe(12);
    expect(slidesOf(html)).toHaveLength(HOME_HERO_LIMIT);
    expect(cardsOf(gridOf(html))).toBe(12);
    expect(gridOf(html)).toContain("Article 19");
    expect(gridOf(html)).not.toContain("Article 18");
  });

  it("reaches every Article by paging: twelve, twelve, then the last six", () => {
    const articles = newestFirst(30);
    const second = gridOf(renderHome({ articles, page: 2 }));
    const third = gridOf(renderHome({ articles, page: 3 }));

    expect(cardsOf(second)).toBe(12);
    expect(second).toContain("Article 18");
    expect(second).toContain("Article 7");

    expect(cardsOf(third)).toBe(6);
    expect(third).toContain("Article 6");
    expect(third).toContain("Article 1");
  });

  it("links to the other pages, and back again", () => {
    const articles = newestFirst(30);
    const first = paginatorOf(renderHome({ articles }));
    const middle = paginatorOf(renderHome({ articles, page: 2 }));
    const last = paginatorOf(renderHome({ articles, page: 3 }));

    expect(first).toContain(attribute(buildHomeListingPath({ locale: "en", page: 2 })));
    expect(first).toContain(attribute(buildHomeListingPath({ locale: "en", page: 3 })));
    expect(first).not.toContain(home.pagination.previous);
    expect(first).toContain(home.pagination.next);

    expect(middle).toContain(home.pagination.previous);
    expect(middle).toContain(home.pagination.next);

    expect(last).toContain(home.pagination.previous);
    expect(last).not.toContain(home.pagination.next);
  });

  it("marks the page being read, and keeps a page past the end on the last page", () => {
    expect(currentPageOf(renderHome({ articles: newestFirst(30) }))).toBe("1");
    expect(currentPageOf(renderHome({ articles: newestFirst(30), page: 2 }))).toBe("2");

    const past = renderHome({ articles: newestFirst(30), page: 99 });
    expect(cardsOf(gridOf(past))).toBe(6);
    expect(currentPageOf(past)).toBe("3");
  });

  it("offers Latest and the top-level Categories above the grid", () => {
    const filter = filterOf(renderHome({ articles: newestFirst(3) }));

    expect(filter).toContain(`aria-label="${home.filter.label}"`);
    const latest = anchorOf(filter, buildHomeListingPath({ locale: "en" }));
    expect(latest).toContain('aria-current="page"');
    expect(latest).toContain(`>${home.filter.all}</a>`);
    expect(filter).toContain(
      attribute(buildHomeListingPath({ locale: "en", categoryPath: "notes" })),
    );
    expect(filter).toContain(
      attribute(buildHomeListingPath({ locale: "en", categoryPath: "essays" })),
    );
    expect(filter).toContain("Notes");
    expect(filter).toContain("Essays");
    // A count is a browse surface's business; a filter is a choice.
    expect(filter).not.toContain("37");
    expect(filter).not.toContain("11");
    // Top-level Categories only: one row, not the tree.
    expect(filter).not.toContain("Tools");
  });

  it("marks the selected Category as the current entry, and Latest as not", () => {
    const filter = filterOf(renderHome({ articles: newestFirst(3), categoryPath: "notes" }));

    const notes = anchorOf(filter, buildHomeListingPath({ locale: "en", categoryPath: "notes" }));
    expect(notes).toContain('aria-current="page"');
    expect(notes).toContain(">Notes</a>");
    expect(anchorOf(filter, buildHomeListingPath({ locale: "en" }))).not.toContain(
      "aria-current",
    );
    expect(filter.match(/aria-current="page"/g)).toHaveLength(1);
  });

  it("renders no filter when no Category exists", () => {
    const html = renderHome({ articles: newestFirst(3), categories: [] });

    expect(filterOf(html)).toBe("");
    expect(html).not.toContain('class="home-filter"');
  });

  it("keeps the selected Category and every Category below it", () => {
    const html = renderHome({
      articles: [
        article(9, { category: { slug: "tools", path: "notes/tools", name: "Tools" } }),
        article(8, { category: { slug: "notes", path: "notes", name: "Notes" } }),
        article(7, { category: { slug: "essays", path: "essays", name: "Essays" } }),
        article(6, { category: null }),
        article(5, { category: { slug: "notebooks", path: "notes/notebooks", name: "Notebooks" } }),
        article(4, { category: { slug: "notes", path: "essays/notes", name: "Notes of Essays" } }),
      ],
      categoryPath: "notes",
    });
    const grid = gridOf(html);

    expect(grid).toContain("Article 9"); // a descendant
    expect(grid).toContain("Article 8"); // the Category itself
    expect(grid).toContain("Article 5"); // another descendant
    expect(grid).not.toContain("Article 7"); // a sibling
    expect(grid).not.toContain("Article 6"); // no Category at all
    expect(grid).not.toContain("Article 4"); // a path that only shares the letters
    // The hero highlights the newest Articles of the whole site, never a filter.
    expect(heroOf(html)).toContain("Article 7");
  });

  it("carries the Category into the page links, so filtering survives paging", () => {
    const paginator = paginatorOf(
      renderHome({ articles: newestFirst(30), categoryPath: "notes" }),
    );

    for (const page of [2, 3]) {
      expect(paginator).toContain(
        attribute(buildHomeListingPath({ locale: "en", categoryPath: "notes", page })),
      );
    }
    expect(paginator).toContain(home.pagination.next);
    expect(paginator).not.toContain(attribute(buildHomeListingPath({ locale: "en", page: 2 })));
  });

  it("says an empty Category in the site's own empty state, and draws no pages", () => {
    const html = renderHome({ articles: newestFirst(3), categoryPath: "essays" });

    // The state a bare Category page shows, not a sentence in the grid's slot:
    // one bare surface on the site, so it reads like the rest of the site.
    expect(html).toContain('<section class="empty-state">');
    expect(html).toContain('<h2 class="empty-state-title">' + home.emptyTitle + "</h2>");
    expect(html).toContain('<p class="empty-state-body">' + home.emptyCategory + "</p>");
    expect(html).not.toContain("reader-empty");
    expect(html).not.toContain("article-grid");
    expect(html).not.toContain("home-pagination");
  });

  it("shows no paginator when a selection fits on one page", () => {
    const essays = [3, 2, 1].map((index) =>
      article(index, { category: { slug: "essays", path: "essays", name: "Essays" } }),
    );
    const html = renderHome({ articles: essays, categoryPath: "essays" });

    expect(cardsOf(gridOf(html))).toBe(3);
    expect(html).not.toContain("home-pagination");
  });

  it("labels every slide with its place in the carousel", () => {
    const hero = heroOf(renderHome({ articles: newestFirst(5) }));

    expect(hero.match(/aria-roledescription="slide"/g)).toHaveLength(HOME_HERO_LIMIT);
    expect(hero).toContain('aria-label="Article 1 of 5"');
    expect(hero).toContain('aria-label="Article 5 of 5"');
  });

  it("shows the Category, title, two-line excerpt and date inside the hero", () => {
    const hero = heroOf(renderHome({ articles: [article(1)] }));

    expect(hero).toContain("Notes");
    expect(hero).toContain("Article 1");
    expect(hero).toContain("Summary 1");
    expect(hero).toContain('dateTime="2025-06-15T08:30:00.000Z"');
    expect(hero).toContain("June 15, 2025");
    // The link is the title, never the whole slide.
    expect(hero).toContain('<a href="/en/articles/article-1">Article 1</a>');
  });

  it("gives the carousel its arrows, pause and dots, but not for a single Article", () => {
    const hero = heroOf(renderHome({ articles: newestFirst(3) }));

    expect(hero).toContain('aria-label="Previous article"');
    expect(hero).toContain('aria-label="Next article"');
    expect(hero).toContain('aria-label="Pause the carousel"');
    expect(hero.match(/class="home-hero-dot(?: [^"]*)?"/g)).toHaveLength(3);
    expect(hero).toContain('aria-label="Show article 1"');
    expect(hero).toContain('aria-current="true"');

    const single = heroOf(renderHome({ articles: [article(1)] }));
    expect(single).not.toContain("home-hero-arrow");
    expect(single).not.toContain("home-hero-pause");
    expect(single).not.toContain("home-hero-dot");
  });

  it("says one sentence and renders no filter, grid or pages when nothing is published", () => {
    const html = renderHome({ articles: [] });

    expect(html).toContain(`<h1 class="home-title">${t.chrome.siteName}</h1>`);
    expect(html).toContain(t.reader.home.empty);
    expect(html).not.toContain("home-hero");
    expect(html).not.toContain("home-filter");
    expect(html).not.toContain("article-grid");
    expect(html).not.toContain("article-card");
    expect(html).not.toContain("home-pagination");
  });

  it("shows no Post anywhere", () => {
    const html = renderHome({
      articles: [
        article(2, {
          cover: { address: "/media/x/display.webp", width: 1600, height: 1000 },
        }),
        article(1),
      ],
    });

    expect(html).not.toContain("post-");
    expect(html).not.toContain("/posts/");
    expect(html).not.toContain("/feed");
  });

  it("designs a bare hero slide instead of leaving a gap where a cover would be", () => {
    const withoutCover = heroOf(renderHome({ articles: [article(1)] }));
    const withCover = heroOf(
      renderHome({
        articles: [
          article(1, {
            cover: { address: "/media/x/display.webp", width: 1600, height: 1000 },
          }),
        ],
      }),
    );

    expect(withoutCover).toContain("home-hero-slide--bare");
    expect(withoutCover).not.toContain("home-hero-image");
    expect(withCover).toContain("home-hero-image");
    expect(withCover).not.toContain("home-hero-slide--bare");
  });
});
