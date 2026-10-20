import { readFileSync } from "node:fs";
import path from "node:path";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { EmptyState } from "./empty-state";

/**
 * An empty surface is a designed state, not a gap: the title says what the
 * surface is, the sentence says why it is bare, and an action is offered only
 * where the Reader can actually take it. The same component is used by the
 * reading surfaces and the console, so the shape is asserted once.
 */
describe("the empty state", () => {
  it("draws a title, one sentence, and nothing else", () => {
    const html = renderToStaticMarkup(
      <EmptyState title="Nothing here yet" body="No article has been published yet." />,
    );

    expect(html).toBe(
      '<section class="empty-state"><h2 class="empty-state-title">Nothing here yet</h2><p class="empty-state-body">No article has been published yet.</p></section>',
    );
  });

  it("takes the page's own heading where the state is the whole page", () => {
    const html = renderToStaticMarkup(
      <EmptyState level={1} title="Page not found" body="There is nothing at this address." />,
    );

    expect(html).toContain('<h1 class="empty-state-title">Page not found</h1>');
  });

  it("offers an action only where the surface has one", () => {
    const without = renderToStaticMarkup(<EmptyState title="Title" body="Body." />);
    const with_ = renderToStaticMarkup(
      <EmptyState title="Title" body="Body." action={<a href="#new-article">New Article</a>} />,
    );

    expect(without).not.toContain("empty-state-action");
    expect(with_).toContain('<div class="empty-state-action"><a href="#new-article">New Article</a></div>');
  });
});

/**
 * Every surface that can be bare reaches for the one component. A surface that
 * still renders its own sentence is a second empty state to maintain, and the
 * one a Reader finds first is whichever page they happened to open.
 */
const EMPTY_SURFACES = [
  ["the front page", "src/components/reader-home.tsx"],
  ["a Category", "src/app/[locale]/categories/[[...path]]/page.tsx"],
  ["a Tag", "src/app/[locale]/tags/[slug]/page.tsx"],
  ["search", "src/app/[locale]/search/page.tsx"],
  ["the archive", "src/app/[locale]/archive/page.tsx"],
  ["the Feed", "src/components/feed.tsx"],
  ["the Asset library", "src/components/admin/asset-library.tsx"],
  ["the dashboard", "src/components/admin/dashboard-table.tsx"],
] as const;

describe("the surfaces that can be bare", () => {
  it.each(EMPTY_SURFACES)("%s draws the one empty state", (_surface, file) => {
    const source = readFileSync(path.resolve(process.cwd(), file), "utf8");

    expect(source).toContain("<EmptyState");
    expect(source).toContain("title=");
    expect(source).toContain("body=");
  });
});
