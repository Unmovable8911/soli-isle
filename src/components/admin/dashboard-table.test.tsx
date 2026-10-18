import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { messages } from "@/messages";
import type { ArticleSummary } from "@/services/articles";
import type { PostSummary } from "@/services/posts";

import { DashboardTable } from "./dashboard-table";

const labels = messages.zh.admin.dashboard;

/** The three stored states, and the four derived ones they must never be confused with. */
const DRAFT: ArticleSummary = {
  id: "01DRAFT",
  slug: "draft-one",
  defaultLocale: "zh",
  publicationState: "draft",
  publishTime: null,
  visibility: "draft",
  categoryId: null,
  category: null,
  coverAssetId: null,
  tags: [],
  translations: [
    { locale: "zh", title: "草稿一篇", updatedAt: "2025-06-15T08:30:00.000Z", version: 1 },
  ],
  createdAt: "2025-06-14T08:30:00.000Z",
  updatedAt: "2025-06-15T08:30:00.000Z",
};

const SCHEDULED: ArticleSummary = {
  ...DRAFT,
  id: "01SCHEDULED",
  slug: "scheduled-one",
  publicationState: "published",
  publishTime: "2027-01-01T01:00:00.000Z",
  visibility: "scheduled",
  translations: [
    { locale: "zh", title: "定时的一篇", updatedAt: "2025-06-15T08:30:00.000Z", version: 2 },
  ],
};

const VISIBLE: ArticleSummary = {
  ...DRAFT,
  id: "01VISIBLE",
  slug: "live-one",
  publicationState: "published",
  publishTime: "2025-06-15T08:30:00.000Z",
  visibility: "visible",
  translations: [
    // An English-only version: the list still shows the work, under its default Locale.
    { locale: "en", title: "Live one", updatedAt: "2025-06-15T08:30:00.000Z", version: 1 },
  ],
};

const ARCHIVED: ArticleSummary = {
  ...DRAFT,
  id: "01ARCHIVED",
  slug: "archived-one",
  publicationState: "archived",
  publishTime: "2025-01-01T01:00:00.000Z",
  visibility: "archived",
  translations: [
    { locale: "zh", title: "归档的一篇", updatedAt: "2025-06-15T08:30:00.000Z", version: 3 },
  ],
};

const UNTITLED: ArticleSummary = {
  ...DRAFT,
  id: "01UNTITLED",
  slug: "untitled-one",
  translations: [{ locale: "zh", title: "   ", updatedAt: "2025-06-15T08:30:00.000Z", version: 1 }],
};

const POST: PostSummary = {
  id: "01POST",
  defaultLocale: "zh",
  publicationState: "published",
  publishTime: "2027-02-02T02:00:00.000Z",
  visibility: "scheduled",
  images: [],
  tags: [],
  translations: [{ locale: "zh", updatedAt: "2025-06-15T08:30:00.000Z", version: 1 }],
  createdAt: "2025-06-14T08:30:00.000Z",
  updatedAt: "2025-06-15T08:30:00.000Z",
};

function render(articles: ArticleSummary[], posts: PostSummary[] = []): string {
  return renderToStaticMarkup(
    <DashboardTable
      articles={articles}
      posts={posts}
      labels={labels}
      renderActions={(row) => <span data-row={`${row.kind}:${row.id}:${row.visibility}`} />}
    />,
  );
}

describe("dashboard", () => {
  it("names the state the service derived, never the stored one", () => {
    const html = render([DRAFT, SCHEDULED, VISIBLE, ARCHIVED]);

    for (const label of [labels.state.draft, labels.state.scheduled, labels.state.visible, labels.state.archived]) {
      expect(html).toContain(label);
    }
    // A draft reports "draft", and a published work whose Publish Time has not
    // arrived reports "scheduled" — neither may report the other.
    expect(html).toContain(`publication-state-draft">${labels.state.draft}`);
    expect(html).toContain(`publication-state-scheduled">${labels.state.scheduled}`);
    expect(html).toContain(`publication-state-visible">${labels.state.visible}`);
    expect(html).toContain(`publication-state-archived">${labels.state.archived}`);
  });

  it("shows the Publish Time as a machine-readable instant and a site-time label", () => {
    const html = render([VISIBLE, DRAFT]);

    // 08:30 UTC is 16:30 in the site timezone (Asia/Shanghai). React emits the
    // attribute as `dateTime`; HTML attribute names are case-insensitive.
    expect(html).toMatch(
      /<time dateTime="2025-06-15T08:30:00\.000Z">2025-06-15 16:30<\/time>/i,
    );
    expect(html).toContain(labels.neverPublished);
  });

  it("lists every Article and Post on one page, each in its own section", () => {
    const html = render([DRAFT], [POST]);

    expect(html).toContain(`<h2 id="dashboard-articles">${labels.articles.title}</h2>`);
    expect(html).toContain(`<h2 id="dashboard-posts">${labels.posts.title}</h2>`);
    expect(html).toContain("draft-one");
    expect(html).toContain('href="/admin/posts/01POST"');
  });

  it("hands each row its derived visibility, so the row actions match the label", () => {
    const html = render([DRAFT, SCHEDULED], [POST]);

    expect(html).toContain('data-row="article:01DRAFT:draft"');
    expect(html).toContain('data-row="article:01SCHEDULED:scheduled"');
    expect(html).toContain('data-row="post:01POST:scheduled"');
  });

  it("falls back to the default Locale's title and says so when there is none", () => {
    expect(render([VISIBLE])).toContain("Live one");
    expect(render([UNTITLED])).toContain(labels.untitled);
  });

  it("links each Article to its editor", () => {
    expect(render([DRAFT])).toContain('href="/admin/articles/01DRAFT"');
  });

  it("says the list is empty instead of rendering an empty table", () => {
    const html = render([], []);

    expect(html).toContain(labels.articles.empty);
    expect(html).toContain(labels.posts.empty);
    expect(html).not.toContain("<table");
  });
});
