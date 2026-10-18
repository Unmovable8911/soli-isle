import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ArticleCard } from "./article-card";

const COVER = { address: "/media/01JCARD/display.webp", width: 1600, height: 1000 };

describe("the Article card", () => {
  it("reaches the Article through its title, and says what the card is about", () => {
    const html = renderToStaticMarkup(
      <ArticleCard
        href="/en/articles/hello-world"
        kicker="Notes"
        kickerHref="/en/categories/notes"
        title="Hello, World"
        summary="syntax highlighting for a static site"
        meta={<time dateTime="2025-06-15T08:30:00.000Z">June 15, 2025</time>}
        cover={null}
      />,
    );

    expect(html).toContain('href="/en/articles/hello-world"');
    expect(html).toContain("Hello, World");
    expect(html).toContain("syntax highlighting for a static site");
    expect(html).toContain('href="/en/categories/notes"');
    expect(html).toContain('dateTime="2025-06-15T08:30:00.000Z"');
    // Two links and no more: the title and the Category. The card itself is
    // not a link, so nothing here is click-once-but-unfocusable.
    expect(html.match(/<a /g)).toHaveLength(2);
    expect(html).not.toContain("onclick");
  });

  it("crops the cover in the card's own frame, decoration only", () => {
    const html = renderToStaticMarkup(
      <ArticleCard href="/en/articles/hello-world" title="Hello, World" cover={COVER} />,
    );

    expect(html).toContain("<img");
    expect(html).toContain('src="/media/01JCARD/display.webp"');
    expect(html).toContain('width="1600"');
    expect(html).toContain('height="1000"');
    // The title says what the piece is; a second description would repeat it.
    expect(html).toContain('alt=""');
  });

  it("shows a search hit's body excerpt instead of the summary", () => {
    const html = renderToStaticMarkup(
      <ArticleCard
        href="/en/articles/hello-world"
        title="Hello, World"
        summary="syntax highlighting for a static site"
        snippet={<span>…the <mark>needle</mark> sits here…</span>}
        cover={null}
      />,
    );

    expect(html).toContain("<mark>needle</mark>");
    expect(html).not.toContain("syntax highlighting for a static site");
  });

  it("leaves no image area at all when the Article has no cover", () => {
    const html = renderToStaticMarkup(
      <ArticleCard
        href="/en/articles/hello-world"
        title="Hello, World"
        summary="A piece"
        cover={null}
      />,
    );

    expect(html).not.toContain("<img");
    // Not a grey box, not an empty frame: the card simply starts at its title.
    expect(html).not.toContain("article-card-cover");
    expect(html).toBe('<article class="article-card"><div class="article-card-body"><h2 class="article-card-title"><a href="/en/articles/hello-world">Hello, World</a></h2><p class="article-card-summary">A piece</p></div></article>');
  });
});
