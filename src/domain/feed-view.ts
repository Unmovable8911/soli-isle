/**
 * The shape a Feed card is handed by the server.
 *
 * It is a presentation contract, not a domain type: the two things a card may
 * not compute for itself — the relative time and the rendered body — arrive
 * already finished, because both are computed exactly once during the server
 * render (the initial batch and every "load older" page alike).
 */
export interface FeedImageView {
  /** The cropped Feed cell: the `display` WebP variant. */
  src: string;
  srcset: string | null;
  /** The untouched upload, at its original ratio, which the lightbox opens. */
  original: string;
  alt: string;
  width: number;
  height: number;
}

export interface FeedCardView {
  id: string;
  /** The machine-readable instant, for `<time datetime>`. */
  publishTime: string;
  /** The visible label, computed once at render and never refreshed. */
  relativeTime: string;
  /** The hover title: exact to the minute, hardcoded, never localised. */
  absoluteTime: string;
  bodyHtml: string;
  images: FeedImageView[];
  tags: { slug: string; name: string }[];
}

export interface FeedView {
  posts: FeedCardView[];
  /** Null when nothing older exists, which is what hides the load-older control. */
  nextCursor: string | null;
  /** The Tag the Feed is filtered to, when a Tag was tapped. */
  tag: { slug: string; name: string } | null;
}
