"use client";

import Link from "next/link";
import { useEffect, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";

import { wrapIndex } from "@/domain/carousel";
import type { Messages } from "@/messages";

import { ArrowLeftIcon, ArrowRightIcon, PauseIcon, PlayIcon } from "./icons";

/** How long one Article stays on screen while the carousel is playing. */
export const AUTOPLAY_MS = 5000;

export interface HomeHeroCover {
  address: string;
  width: number;
  height: number;
}

/**
 * One Article as the hero needs it. This is a plain serialisable record built
 * by the server page: the client must not reach into the reading service, and
 * the date is formatted where the Locale and the site time zone are known.
 */
export interface HomeHeroSlide {
  id: string;
  href: string;
  title: string;
  summary: string | null;
  category: string | null;
  /** Already formatted in the page's Locale; null when there is no date. */
  dateLabel: string | null;
  dateTime: string | null;
  cover: HomeHeroCover | null;
}

export type HomeHeroLabels = Messages["reader"]["home"]["hero"];

/**
 * Whether the carousel has a reason to move. A pointer inside, focus anywhere
 * inside, a hidden tab and the Reader's own pause all suspend it. A
 * reduced-motion preference starts it paused; that is a pause the Reader can
 * release by hand, which is why the Play button is never taken away.
 */
export function shouldAdvance(state: {
  count: number;
  paused: boolean;
  hovered: boolean;
  focused: boolean;
  documentHidden: boolean;
}): boolean {
  return (
    state.count > 1 &&
    !state.paused &&
    !state.hovered &&
    !state.focused &&
    !state.documentHidden
  );
}

/** "Article 2 of 5": the placeholders every carousel label in the messages carries. */
export function slidePosition(template: string, current: number, total: number): string {
  return template.replace("{current}", String(current)).replace("{total}", String(total));
}

function slideClass(active: boolean, bare: boolean): string {
  const classes = ["home-hero-slide"];
  if (active) {
    classes.push("home-hero-slide--active");
  }
  if (bare) {
    classes.push("home-hero-slide--bare");
  }
  return classes.join(" ");
}

/**
 * The newest Articles as a carousel: one cover at a time, the Category, title,
 * two-line excerpt and Publish Time laid over it, with the dots and the arrows
 * as the only controls.
 *
 * Every slide is in the DOM and stacked in one grid cell, so the frame takes
 * the height of the longest slide and a long title is never cropped by a fixed
 * aspect ratio. Inactive slides are `inert` as well as transparent: a Reader
 * tabbing through the page never lands in an Article they cannot see.
 */
export function HomeHero({
  slides,
  labels,
}: {
  slides: readonly HomeHeroSlide[];
  labels: HomeHeroLabels;
}) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [documentHidden, setDocumentHidden] = useState(false);

  const count = slides.length;
  const activeIndex = wrapIndex(active, 0, count);

  // A Reader who asked for less motion gets a still hero until they ask for
  // motion themselves; the Play button remains the way to ask.
  useEffect(() => {
    if (typeof window.matchMedia !== "function") {
      return;
    }
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (query.matches) {
      setPaused(true);
    }
    const onChange = (event: MediaQueryListEvent): void => {
      if (event.matches) {
        setPaused(true);
      }
    };
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  // A background tab should not come back several Articles further along.
  useEffect(() => {
    const update = (): void => setDocumentHidden(document.hidden);
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);

  useEffect(() => {
    if (!shouldAdvance({ count, paused, hovered, focused, documentHidden })) {
      return;
    }
    // activeIndex in the dependency list is the reset: a hand-picked slide gets
    // a full interval of its own before the carousel moves on.
    const next = wrapIndex(activeIndex, 1, count);
    const timer = window.setTimeout(() => setActive(next), AUTOPLAY_MS);
    return () => window.clearTimeout(timer);
  }, [activeIndex, count, paused, hovered, focused, documentHidden]);

  if (count === 0) {
    return null;
  }

  const hasControls = count > 1;

  const step = (delta: number): void => {
    setActive((current) => wrapIndex(current, delta, count));
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLElement>): void => {
    // A title link is a destination, not a slide control. Stepping here would
    // hide the element the Reader is holding focus on.
    if (!hasControls || (event.target instanceof Element && event.target.closest("a") !== null)) {
      return;
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      step(-1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      step(1);
    }
  };

  return (
    <section
      className="home-hero"
      aria-roledescription="carousel"
      aria-label={labels.label}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onKeyDown={handleKeyDown}
    >
      <div className="home-hero-slides">
        {slides.map((slide, index) => {
          const isActive = index === activeIndex;
          return (
            <article
              key={slide.id}
              className={slideClass(isActive, slide.cover === null)}
              aria-roledescription="slide"
              aria-label={slidePosition(labels.slide, index + 1, count)}
              aria-hidden={isActive ? undefined : true}
              inert={!isActive}
            >
              {slide.cover !== null && (
                // eslint-disable-next-line @next/next/no-img-element -- the address comes from the Asset store, not the image optimizer
                <img
                  className="home-hero-image"
                  src={slide.cover.address}
                  width={slide.cover.width}
                  height={slide.cover.height}
                  alt=""
                  loading={index === 0 ? "eager" : "lazy"}
                  decoding="async"
                />
              )}
              <div className="home-hero-content">
                {slide.category !== null && <p className="home-hero-category">{slide.category}</p>}
                <h2 className="home-hero-title">
                  <Link href={slide.href}>{slide.title}</Link>
                </h2>
                {slide.summary !== null && <p className="home-hero-summary">{slide.summary}</p>}
                {slide.dateLabel !== null && slide.dateTime !== null && (
                  <p className="home-hero-meta">
                    <time dateTime={slide.dateTime}>{slide.dateLabel}</time>
                  </p>
                )}
              </div>
            </article>
          );
        })}
      </div>
      {hasControls && (
        <>
          <button
            type="button"
            className="home-hero-arrow home-hero-arrow--previous"
            aria-label={labels.previous}
            onClick={() => step(-1)}
          >
            <ArrowLeftIcon />
          </button>
          <button
            type="button"
            className="home-hero-arrow home-hero-arrow--next"
            aria-label={labels.next}
            onClick={() => step(1)}
          >
            <ArrowRightIcon />
          </button>
          <button
            type="button"
            className="home-hero-pause"
            aria-label={paused ? labels.play : labels.pause}
            onClick={() => setPaused((current) => !current)}
          >
            {paused ? <PlayIcon /> : <PauseIcon />}
          </button>
          <div className="home-hero-dots" role="group" aria-label={labels.choose}>
            {slides.map((slide, index) => (
              <button
                key={slide.id}
                type="button"
                className={
                  index === activeIndex ? "home-hero-dot home-hero-dot--active" : "home-hero-dot"
                }
                aria-label={slidePosition(labels.goTo, index + 1, count)}
                aria-current={index === activeIndex ? "true" : undefined}
                onClick={() => setActive(index)}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
