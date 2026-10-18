import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { FeedHeading } from "./feed";

const LABELS = {
  title: "Feed",
  emptyTitle: "The stream is empty",
  empty: "No posts yet.",
  loadOlder: "Load older",
  loading: "Loading…",
  loadFailed: "Could not load older posts.",
  expand: "Read more",
  gallery: { label: "Image gallery", counter: "Image {current} of {total}" },
  tagFiltered: "Tag: {name}",
  clearTag: "Show every post",
};

describe("the Feed's page head", () => {
  it("keeps the Tag filter in the head, above the title, where it scopes the page", () => {
    const html = renderToStaticMarkup(
      <FeedHeading
        locale="en"
        tag={{ slug: "travel", name: "Travel" }}
        labels={LABELS}
        title="Feed"
      />,
    );

    expect(html).toMatch(/^<header class="feed-heading">/);
    expect(html).toContain("Tag: Travel");
    expect(html.indexOf("feed-filter")).toBeLessThan(html.indexOf("feed-title"));
    expect(html).toContain('href="/en/feed"');
  });

  it("shows no scope line when the whole Feed is on screen", () => {
    const html = renderToStaticMarkup(
      <FeedHeading locale="en" tag={null} labels={LABELS} title="Feed" />,
    );

    expect(html).toContain('class="feed-title"');
    expect(html).not.toContain("feed-filter");
    expect(html).not.toContain("href=");
  });
});
