"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

import type { Locale } from "@/config/site";
import type { FeedCardView, FeedImageView } from "@/domain/feed-view";
import { POST_FOLD_MAX_HEIGHT_PX, postBodyShouldFold } from "@/domain/post-fold";
import { buildFeedPath } from "@/domain/public-paths";
import type { Messages } from "@/messages";

import { Lightbox, type LightboxImage, type LightboxLabels } from "./lightbox";

export type FeedLabels = Messages["reader"]["feed"];

const IMAGE_SIZES = "(max-width: 48rem) 85vw, 640px";

function counterText(labels: FeedLabels, current: number, total: number): string {
  return labels.gallery.counter
    .replaceAll("{current}", String(current))
    .replaceAll("{total}", String(total));
}

/**
 * A card holds the four things the Feed is allowed to show — relative time,
 * body, image gallery, Tags — and nothing else. In particular there is no
 * per-Post link: a Post has no page to link to, and the card is not an entry
 * point into one.
 */
export function PostCard({
  post,
  locale,
  labels,
  lightboxLabels,
}: {
  post: FeedCardView;
  locale: Locale;
  labels: FeedLabels;
  lightboxLabels: LightboxLabels;
}) {
  return (
    <article className="post-card" data-post-id={post.id}>
      <time className="post-time" dateTime={post.publishTime} title={post.absoluteTime}>
        {post.relativeTime}
      </time>
      <MeasuredPostBody html={post.bodyHtml} labels={labels} />
      {post.images.length > 0 && (
        <PostGallery images={post.images} labels={labels} lightboxLabels={lightboxLabels} />
      )}
      {post.tags.length > 0 && (
        <ul className="post-tags">
          {post.tags.map((tag) => (
            <li key={tag.slug}>
              <Link className="post-tag" href={buildFeedPath({ locale, tagSlug: tag.slug })}>
                {tag.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

/**
 * The body, with the fold already decided. Presentational on purpose: the
 * measurement lives in `MeasuredPostBody` so the markup can be asserted without
 * a layout engine.
 */
export function PostBody({
  html,
  labels,
  folded,
  expanded,
  onExpand,
}: {
  html: string;
  labels: FeedLabels;
  folded: boolean;
  expanded: boolean;
  onExpand: () => void;
}) {
  const clamped = folded && !expanded;

  return (
    <div className="post-body-wrap">
      <div
        className={`post-body${clamped ? " post-body-folded" : ""}`}
        style={clamped ? { maxHeight: `${POST_FOLD_MAX_HEIGHT_PX}px` } : undefined}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {clamped && (
        <button type="button" className="post-expand" onClick={onExpand}>
          {labels.expand}
        </button>
      )}
    </div>
  );
}

/**
 * The fold is measured, never stored: a Post has no "is long" column. The body
 * is painted at its natural height, measured once, and clamped only when the
 * measurement says it overflows — so a Reader without JavaScript merely gets a
 * long card instead of a card they cannot open.
 */
export function MeasuredPostBody({ html, labels }: { html: string; labels: FeedLabels }) {
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const [folded, setFolded] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const node = bodyRef.current;
    if (node === null) {
      return;
    }
    setFolded(postBodyShouldFold(node.scrollHeight));
  }, [html]);

  return (
    <div className="post-body-measure" ref={bodyRef}>
      <PostBody
        html={html}
        labels={labels}
        folded={folded}
        expanded={expanded}
        onExpand={() => setExpanded(true)}
      />
    </div>
  );
}

/**
 * A horizontally scrolling image set: each cell takes most of the track so the
 * next picture's edge peeks out, one picture snaps per swipe, a `current/total`
 * counter follows the scroll, the arrow keys move between pictures and a tap
 * opens the shared lightbox. The cells are cropped to a viewport-relative box
 * (`cover`) — an Article body image keeps its original ratio, and the two rules
 * are meant to stay different.
 */
export function PostGallery({
  images,
  labels,
  lightboxLabels,
}: {
  images: readonly FeedImageView[];
  labels: FeedLabels;
  lightboxLabels: LightboxLabels;
}) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const pointerScrollLeft = useRef(0);
  const [current, setCurrent] = useState(0);
  const [opened, setOpened] = useState<number | null>(null);

  function cells(): HTMLElement[] {
    const track = trackRef.current;
    return track === null ? [] : Array.from(track.children).filter(isElement);
  }

  function scrollToIndex(index: number) {
    const target = cells()[index];
    if (target === undefined) {
      return;
    }
    const reduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView?.({ behavior: reduced ? "auto" : "smooth", inline: "start", block: "nearest" });
    setCurrent(index);
  }

  function handleScroll() {
    const track = trackRef.current;
    if (track === null) {
      return;
    }
    const origin = track.getBoundingClientRect().left;
    let closest = 0;
    let closestDistance = Number.POSITIVE_INFINITY;
    cells().forEach((cell, index) => {
      const distance = Math.abs(cell.getBoundingClientRect().left - origin);
      if (distance < closestDistance) {
        closestDistance = distance;
        closest = index;
      }
    });
    setCurrent(closest);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      scrollToIndex(Math.min(current + 1, images.length - 1));
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      scrollToIndex(Math.max(current - 1, 0));
    }
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    pointerScrollLeft.current = event.currentTarget.scrollLeft;
  }

  function open(index: number, track: HTMLDivElement) {
    // A swipe also produces a click; only a tap that did not scroll opens the lightbox.
    if (Math.abs(track.scrollLeft - pointerScrollLeft.current) > 4) {
      return;
    }
    setOpened(index);
  }

  const lightboxImages: LightboxImage[] = images.map((image) => ({
    src: image.src,
    original: image.original,
    alt: image.alt,
  }));

  return (
    <div className="post-gallery">
      <div
        className="post-gallery-track"
        ref={trackRef}
        role="group"
        aria-label={labels.gallery.label}
        tabIndex={0}
        onScroll={handleScroll}
        onKeyDown={handleKeyDown}
        onPointerDown={handlePointerDown}
      >
        {images.map((image, index) => (
          <div className="post-gallery-cell" key={`${image.src}-${index}`}>
            <button
              type="button"
              className="post-gallery-open"
              tabIndex={-1}
              onClick={() => {
                const track = trackRef.current;
                if (track !== null) {
                  open(index, track);
                }
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- addresses come from the Asset store, not the image optimizer */}
              <img
                className="post-gallery-image"
                src={image.src}
                srcSet={image.srcset ?? undefined}
                sizes={image.srcset === null ? undefined : IMAGE_SIZES}
                alt={image.alt}
                width={image.width}
                height={image.height}
                loading="lazy"
                data-original={image.original}
              />
            </button>
          </div>
        ))}
      </div>
      <p className="post-gallery-counter" aria-live="polite">
        <span aria-hidden="true">
          {current + 1}/{images.length}
        </span>
        <span className="post-gallery-counter-text">
          {counterText(labels, current + 1, images.length)}
        </span>
      </p>
      {opened !== null && (
        <Lightbox
          images={lightboxImages}
          startIndex={opened}
          labels={lightboxLabels}
          onClose={() => setOpened(null)}
        />
      )}
    </div>
  );
}

function isElement(node: Element): node is HTMLElement {
  return node instanceof HTMLElement;
}
