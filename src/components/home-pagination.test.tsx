import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { buildHomeListingPath } from "@/domain/public-paths";
import { messages } from "@/messages";

import { HomePagination } from "./home-pagination";

const t = messages.en.reader.home.pagination;

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

function render({
  page,
  pageCount,
  categoryPath = null,
}: {
  page: number;
  pageCount: number;
  categoryPath?: string | null;
}): string {
  return renderToStaticMarkup(
    <HomePagination locale="en" categoryPath={categoryPath} page={page} pageCount={pageCount} />,
  );
}

/** The markup React writes for a URL: an ampersand is escaped in the attribute. */
function attribute(url: string): string {
  return `href="${url.replaceAll("&", "&amp;")}"`;
}

describe("the front page's paginator", () => {
  it("draws nothing at all when there is nowhere to go", () => {
    expect(render({ page: 1, pageCount: 1 })).toBe("");
    expect(render({ page: 1, pageCount: 0 })).toBe("");
  });

  it("is a labelled navigation offering one link per page", () => {
    const html = render({ page: 1, pageCount: 3 });

    expect(html.indexOf("<nav")).toBe(0);
    expect(html).toContain(`aria-label="${t.label}"`);
    for (const page of [1, 2, 3]) {
      expect(html).toContain(`aria-label="${t.page.replaceAll("{page}", String(page))}"`);
      expect(html).toContain(attribute(buildHomeListingPath({ locale: "en", page })));
    }
  });

  it("marks the page being read, and only that one", () => {
    const html = render({ page: 2, pageCount: 3 });

    const second = anchorOf(html, buildHomeListingPath({ locale: "en", page: 2 }));
    expect(second).toContain('aria-current="page"');
    expect(second).toContain(">2</a>");
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
  });

  it("offers the previous page only after the first, and the next only before the last", () => {
    const first = render({ page: 1, pageCount: 3 });
    expect(first).not.toContain(t.previous);
    expect(first).toContain(t.next);

    const middle = render({ page: 2, pageCount: 3 });
    expect(middle).toContain(t.previous);
    expect(middle).toContain(t.next);

    const last = render({ page: 3, pageCount: 3 });
    expect(last).toContain(t.previous);
    expect(last).not.toContain(t.next);
  });

  it("points the previous and next links one page either way", () => {
    const middle = render({ page: 2, pageCount: 3 });

    expect(middle).toContain(attribute(buildHomeListingPath({ locale: "en", page: 1 })));
    expect(middle).toContain(attribute(buildHomeListingPath({ locale: "en", page: 3 })));
  });

  it("carries the Category into every link, so filtering survives paging", () => {
    const html = render({ page: 2, pageCount: 3, categoryPath: "notes/tools" });

    for (const page of [1, 2, 3]) {
      expect(html).toContain(
        attribute(buildHomeListingPath({ locale: "en", categoryPath: "notes/tools", page })),
      );
    }
    expect(html).not.toContain(attribute(buildHomeListingPath({ locale: "en", page: 2 })));
  });

  it("wears the site's pill rather than restating one here", () => {
    // The words and the numbers alike are drawn by the shared pill, so the row
    // cannot drift from the Category pills beside it.
    const html = render({ page: 2, pageCount: 3 });

    expect(html.match(/class="reader-pill"/g)).toHaveLength(5);
  });

  it("offers real anchors rather than a control the reader has to run", () => {
    const html = render({ page: 2, pageCount: 3 });

    expect(html.match(/<a /g)).toHaveLength(5);
    expect(html).not.toContain("onclick");
    expect(html).not.toContain("<button");
  });
});
