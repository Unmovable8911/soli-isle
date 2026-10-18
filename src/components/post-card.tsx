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

/**
 * The cell an arrow key moves focus to, or null for every other key. The arrows
 * stop at the ends — a Feed card is not a carousel that wraps — and Enter/Space
 * need no rule at all, because the cells are real buttons.
 *
 * The cells share one Tab stop (roving `tabIndex`): a nine-picture gallery is
 * one stop, and every picture is still reachable, so the lightbox can hand focus
 * back to the exact cell it was opened from.
 */
export function galleryNextIndex(key: string, current: number, length: number): number | null {
  if (length === 0) {
    return null;
  }
  if (key === "ArrowRight") {
    return Math.min(current + 1, length - 1);
  }
  if (key === "ArrowLeft") {
    return Math.max(current - 1, 0);
  }
  return null;
}

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

  // Expanding removes the control that was just used, so focus is moved onto the
  // text it revealed instead of falling back to the top of the document.
  useEffect(() => {
    if (!expanded) {
      return;
    }
    const node = bodyRef.current;
    if (node === null || node.contains(document.activeElement)) {
      return;
    }
    node.focus();
  }, [expanded]);

  return (
    <div className="post-body-measure" ref={bodyRef} tabIndex={-1}>
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
 * opens the shared lightbox. Keyboard-wise it is one Tab stop on the picture on
 * view, with the arrows moving focus cell to cell (ticket 12). The cells are cropped to a viewport-relative box
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
  const trackRef = useRef<HTMLUListElement | null>(null);
  const cellRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const pointerScrollLeft = useRef(0);
  const [current, setCurrent] = useState(0);
  const [opened, setOpened] = useState<number | null>(null);

  function cells(): HTMLElement[] {
    const track = trackRef.current;
    return track === null ? [] : Array.from(track.children).filter(isElement);
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

  /** Which cell holds focus, so a key moves from where the Reader actually is. */
  function focusedIndex(): number {
    const focused = cellRefs.current.findIndex((cell) => cell === document.activeElement);
    return focused === -1 ? current : focused;
  }

  /** Arrow keys move focus and the track together, keeping the two in step. */
  function focusIndex(index: number) {
    setCurrent(index);
    const cell = cells()[index];
    const reduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    cell?.scrollIntoView?.({ behavior: reduced ? "auto" : "smooth", inline: "start", block: "nearest" });
    cellRefs.current[index]?.focus({ preventScroll: true });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLUListElement>) {
    const index = galleryNextIndex(event.key, focusedIndex(), images.length);
    if (index === null) {
      return;
    }
    event.preventDefault();
    focusIndex(index);
  }

  function handlePointerDown(event: PointerEvent<HTMLUListElement>) {
    pointerScrollLeft.current = event.currentTarget.scrollLeft;
  }

  function open(index: number, track: Element, fromPointer: boolean) {
    // A swipe also produces a click; only a tap that did not scroll opens the
    // lightbox. Keyboard activation (`event.detail === 0`) has no pointerdown
    // behind it, so the swipe guard must not be applied to it.
    if (fromPointer && Math.abs(track.scrollLeft - pointerScrollLeft.current) > 4) {
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
      <ul
        className="post-gallery-track"
        ref={trackRef}
        role="list"
        aria-label={labels.gallery.label}
        onScroll={handleScroll}
        onKeyDown={handleKeyDown}
        onPointerDown={handlePointerDown}
      >
        {images.map((image, index) => (
          <li className="post-gallery-cell" key={`${image.src}-${index}`}>
            <button
              type="button"
              className="post-gallery-open"
              ref={(element) => {
                cellRefs.current[index] = element;
              }}
              tabIndex={index === current ? 0 : -1}
              aria-haspopup="dialog"
              aria-label={counterText(labels, index + 1, images.length)}
              onClick={(event) => {
                const track = trackRef.current;
                if (track !== null) {
                  // A pointer click carries a click count; keyboard activation is 0.
                  open(index, track, event.detail > 0);
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
          </li>
        ))}
      </ul>
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
          returnFocusTo={cellRefs.current[opened] ?? null}
          onClose={() => setOpened(null)}
        />
      )}
    </div>
  );
}

function isElement(node: Element): node is HTMLElement {
  return node instanceof HTMLElement;
}
