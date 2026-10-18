import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { FeedCardView } from "@/domain/feed-view";

import { PostBody, PostCard, PostGallery, galleryNextIndex } from "./post-card";

const LABELS = {
  title: "Feed",
  empty: "No posts yet.",
  loadOlder: "Load older",
  loading: "Loading…",
  loadFailed: "Could not load older posts.",
  expand: "Read more",
  gallery: { label: "Image gallery", counter: "Image {current} of {total}" },
  tagFiltered: "Tag: {name}",
  clearTag: "Show every post",
};

const LIGHTBOX_LABELS = {
  dialog: "Image viewer",
  close: "Close",
  previous: "Previous image",
  next: "Next image",
};

const IMAGES = [
  {
    src: "/media/aaa/display.webp",
    srcset: "/media/aaa/display.webp 1600w, /media/aaa/thumb.webp 800w",
    original: "/media/aaa/original.png",
    alt: "first.png",
    width: 1200,
    height: 800,
  },
  {
    src: "/media/bbb/display.webp",
    srcset: null,
    original: "/media/bbb/original.jpg",
    alt: "second.jpg",
    width: 900,
    height: 1200,
  },
];

const POST: FeedCardView = {
  id: "01JX3Z8Q4A0W7Y6TCVN1KH2M9R",
  publishTime: "2025-06-14T08:30:00.000Z",
  relativeTime: "昨天",
  absoluteTime: "2025-06-14 16:30",
  bodyHtml: "<p>今天走了很远。</p>",
  images: IMAGES,
  tags: [{ slug: "travel", name: "旅行" }],
};

function render(markup: React.ReactElement): string {
  return renderToStaticMarkup(markup);
}

describe("a feed card", () => {
  it("shows exactly the relative time, the body, the image gallery and the Tags", () => {
    const html = render(
      <PostCard post={POST} locale="zh" labels={LABELS} lightboxLabels={LIGHTBOX_LABELS} />,
    );

    expect(html).toContain('class="post-time"');
    expect(html).toContain("昨天");
    expect(html).toContain("<p>今天走了很远。</p>");
    expect(html).toContain('class="post-gallery-track"');
    expect(html).toContain("旅行");
  });

  it("is not an entry point into the Post: the only links are its Tag filters", () => {
    const html = render(
      <PostCard post={POST} locale="zh" labels={LABELS} lightboxLabels={LIGHTBOX_LABELS} />,
    );

    const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((match) => match[1]);
    expect(hrefs).toEqual(["/zh/feed?tag=travel"]);
    expect(html).not.toContain("/posts/");
    expect(html).not.toContain("share");
    expect(html).not.toContain("like");
  });

  it("offers no control that suggests the card itself is something to open", () => {
    const html = render(
      <PostCard post={POST} locale="zh" labels={LABELS} lightboxLabels={LIGHTBOX_LABELS} />,
    );

    // An article, not a link and not a button: the card has no interactive role
    // of its own, and the gallery is the only control inside it.
    expect(html).toMatch(/^<article class="post-card"/);
    expect(html).not.toContain('role="link"');
    const controls = [...html.matchAll(/<button[^>]*class="([^"]*)"/g)].map((match) => match[1]);
    expect(controls).toEqual(["post-gallery-open", "post-gallery-open"]);
  });

  it("emits a machine-readable absolute time and the exact minute on hover", () => {
    const html = render(
      <PostCard post={POST} locale="zh" labels={LABELS} lightboxLabels={LIGHTBOX_LABELS} />,
    );

    expect(html).toMatch(/<time[^>]*class="post-time"/);
    expect(html).toMatch(/<time[^>]*datetime="2025-06-14T08:30:00\.000Z"/i);
    expect(html).toMatch(/<time[^>]*title="2025-06-14 16:30"/);
  });
});

describe("the gallery", () => {
  it("is a labelled list of cells, one per picture", () => {
    const html = render(
      <PostGallery images={IMAGES} labels={LABELS} lightboxLabels={LIGHTBOX_LABELS} />,
    );

    expect(html).toContain('role="list"');
    expect(html).toContain('aria-label="Image gallery"');
    expect(html.match(/<li class="post-gallery-cell"/g)).toHaveLength(2);
  });

  it("keeps the whole gallery one Tab stop, on the picture on view", () => {
    const html = render(
      <PostGallery images={IMAGES} labels={LABELS} lightboxLabels={LIGHTBOX_LABELS} />,
    );

    const buttons = [...html.matchAll(/<button[^>]*class="post-gallery-open"[^>]*>/g)].map(
      (match) => match[0],
    );
    expect(buttons).toHaveLength(2);
    // The cell on view is reachable; the others are only reachable with the arrow keys.
    expect(buttons[0]).toContain('tabindex="0"');
    expect(buttons[1]).toContain('tabindex="-1"');
  });

  it("says which picture each open control shows without describing the file", () => {
    const html = render(
      <PostGallery images={IMAGES} labels={LABELS} lightboxLabels={LIGHTBOX_LABELS} />,
    );

    expect(html).toContain('aria-label="Image 1 of 2"');
    expect(html).toContain('aria-label="Image 2 of 2"');
    expect(html).toContain('aria-haspopup="dialog"');
  });

  it("shows the current position and the total", () => {
    const html = render(
      <PostGallery images={IMAGES} labels={LABELS} lightboxLabels={LIGHTBOX_LABELS} />,
    );

    // The visible fraction is decoration; the sentence is what an AT user hears.
    expect(html).toContain('<span aria-hidden="true">1/2</span>');
    expect(html).toContain("Image 1 of 2");
    expect(html).toContain('aria-live="polite"');
  });

  it("crops cells from the display variant while keeping the original for the lightbox", () => {
    const html = render(
      <PostGallery images={IMAGES} labels={LABELS} lightboxLabels={LIGHTBOX_LABELS} />,
    );

    expect(html).toContain('src="/media/aaa/display.webp"');
    // React serialises the camelCase `srcSet` prop as-is; HTML attribute names are case-insensitive.
    expect(html).toMatch(/srcset="\/media\/aaa\/display\.webp 1600w, \/media\/aaa\/thumb\.webp 800w"/i);
    expect(html).toContain('data-original="/media/aaa/original.png"');
    expect(html).toContain('width="1200"');
    expect(html).toContain('height="800"');
  });
});

describe("gallery keys", () => {
  it("moves one picture at a time and stops at the ends", () => {
    expect(galleryNextIndex("ArrowRight", 0, 3)).toBe(1);
    expect(galleryNextIndex("ArrowLeft", 2, 3)).toBe(1);
    expect(galleryNextIndex("ArrowRight", 2, 3)).toBe(2);
    expect(galleryNextIndex("ArrowLeft", 0, 3)).toBe(0);
  });

  it("leaves activation and every other key to the browser", () => {
    // The cells are real buttons, so Enter and Space already open the picture.
    expect(galleryNextIndex("Enter", 1, 3)).toBeNull();
    expect(galleryNextIndex(" ", 1, 3)).toBeNull();
    expect(galleryNextIndex("Tab", 1, 3)).toBeNull();
    expect(galleryNextIndex("ArrowRight", 0, 0)).toBeNull();
  });
});

describe("the fold", () => {
  const folded = (isFolded: boolean, expanded = false) =>
    render(
      <PostBody
        html={"<p>很长很长</p>"}
        labels={LABELS}
        folded={isFolded}
        expanded={expanded}
        onExpand={() => {}}
      />,
    );

  it("clamps a measured-too-tall body and offers the inline expand control", () => {
    const html = folded(true);

    expect(html).toContain('class="post-body post-body-folded"');
    expect(html).toContain("max-height:320px");
    expect(html).toContain("Read more");
  });

  it("folds in place: the control is a button, and nothing here navigates", () => {
    const html = folded(true);

    expect(html).toContain('<button type="button" class="post-expand">Read more</button>');
    // Expanding is client state. An anchor is the only element that can change
    // the URL or fetch a document, and the folded body holds none.
    expect(html).not.toContain("<a ");
    expect(html).not.toContain("href");
  });

  it("leaves a body that fits alone", () => {
    const html = folded(false);

    expect(html).toContain('class="post-body"');
    expect(html).not.toContain("Read more");
  });

  it("stops clamping once expanded, keeping the body in place", () => {
    const html = folded(true, true);

    expect(html).toContain('class="post-body"');
    expect(html).not.toContain("Read more");
    expect(html).toContain("<p>很长很长</p>");
  });
});
