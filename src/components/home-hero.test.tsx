// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { messages } from "@/messages";

import {
  AUTOPLAY_MS,
  HomeHero,
  shouldAdvance,
  slidePosition,
  type HomeHeroSlide,
} from "./home-hero";

const labels = messages.en.reader.home.hero;

function slide(index: number, extra: Partial<HomeHeroSlide> = {}): HomeHeroSlide {
  return {
    id: `slide-${index}`,
    href: `/en/articles/slide-${index}`,
    title: `Article ${index}`,
    summary: `Summary ${index}`,
    category: "Notes",
    dateLabel: "June 15, 2025",
    dateTime: "2025-06-15T08:30:00.000Z",
    cover: null,
    ...extra,
  };
}

function htmlOf(slides: readonly HomeHeroSlide[]): string {
  return renderToStaticMarkup(<HomeHero slides={slides} labels={labels} />);
}

const runtime = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  runtime.IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  runtime.IS_REACT_ACT_ENVIRONMENT = undefined;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

async function render(slides: readonly HomeHeroSlide[]): Promise<void> {
  await act(async () => root.render(<HomeHero slides={slides} labels={labels} />));
}

function activeTitle(): string | null {
  return host.querySelector(".home-hero-slide--active .home-hero-title")?.textContent ?? null;
}

async function advance(milliseconds: number): Promise<void> {
  await act(async () => {
    vi.advanceTimersByTime(milliseconds);
  });
}

describe("shouldAdvance", () => {
  const moving = {
    count: 3,
    paused: false,
    hovered: false,
    focused: false,
    documentHidden: false,
  };

  it("moves when nothing is holding it", () => {
    expect(shouldAdvance(moving)).toBe(true);
  });

  it.each([
    ["paused", { paused: true }],
    ["hovered", { hovered: true }],
    ["focused", { focused: true }],
    ["in a hidden tab", { documentHidden: true }],
    ["the only Article", { count: 1 }],
  ])("holds still when %s", (_name, state) => {
    expect(shouldAdvance({ ...moving, ...state })).toBe(false);
  });
});

describe("slidePosition", () => {
  it("fills both placeholders", () => {
    expect(slidePosition(labels.slide, 2, 5)).toBe("Article 2 of 5");
    expect(slidePosition(labels.goTo, 2, 5)).toBe("Show article 2");
  });
});

describe("the hero's markup", () => {
  it("renders one slide per Article, newest first, with only the first current", () => {
    const html = htmlOf([slide(3), slide(2), slide(1)]);

    expect(html.match(/class="home-hero-slide(?: [^"]*)?"/g)).toHaveLength(3);
    expect(html.match(/home-hero-slide--active/g)).toHaveLength(1);
    expect(html.indexOf(">Article 3</a>")).toBeLessThan(html.indexOf(">Article 2</a>"));
    expect(html.indexOf(">Article 2</a>")).toBeLessThan(html.indexOf(">Article 1</a>"));
    expect(html).toContain('aria-label="Article 1 of 3"');
  });

  it("keeps every slide but the current one out of the accessibility tree", () => {
    const html = htmlOf([slide(3), slide(2), slide(1)]);
    const articles = html.match(/<article[^>]*>/g) ?? [];

    expect(articles.filter((article) => article.includes('aria-hidden="true"'))).toHaveLength(2);
    expect(html).not.toContain('aria-hidden="false"');
  });

  it("draws the cover when there is one and a designed bare plate when there is not", () => {
    const covered = htmlOf([
      slide(1, {
        cover: { address: "/media/x/display.webp", width: 1600, height: 1000 },
      }),
    ]);
    const bare = htmlOf([slide(1)]);

    expect(covered).toContain('class="home-hero-image"');
    expect(covered).toContain('width="1600"');
    expect(covered).not.toContain("home-hero-slide--bare");
    expect(bare).toContain("home-hero-slide--bare");
    expect(bare).not.toContain("home-hero-image");
  });

  it("offers no carousel controls for a single Article", () => {
    const html = htmlOf([slide(1)]);

    expect(html).not.toContain("home-hero-arrow");
    expect(html).not.toContain("home-hero-pause");
    expect(html).not.toContain("home-hero-dot");
  });

  it("names the arrows, the pause and every dot", () => {
    const html = htmlOf([slide(1), slide(2), slide(3)]);

    expect(html).toContain(`aria-label="${labels.previous}"`);
    expect(html).toContain(`aria-label="${labels.next}"`);
    expect(html).toContain(`aria-label="${labels.pause}"`);
    expect(html.match(/class="home-hero-dot(?: [^"]*)?"/g)).toHaveLength(3);
    expect(html).toContain(`aria-label="${slidePosition(labels.goTo, 1, 3)}"`);
    expect(html).toContain('aria-current="true"');
  });
});

describe("the hero's clock", () => {
  it("advances every five seconds and wraps at the end", async () => {
    vi.useFakeTimers();
    await render([slide(3), slide(2), slide(1)]);

    expect(activeTitle()).toBe("Article 3");
    await advance(AUTOPLAY_MS);
    expect(activeTitle()).toBe("Article 2");
    await advance(AUTOPLAY_MS);
    expect(activeTitle()).toBe("Article 1");
    await advance(AUTOPLAY_MS);
    expect(activeTitle()).toBe("Article 3");
  });

  it("gives a hand-picked Article a full interval before moving on", async () => {
    vi.useFakeTimers();
    await render([slide(1), slide(2), slide(3), slide(4), slide(5)]);

    const dots = host.querySelectorAll<HTMLButtonElement>(".home-hero-dot");
    await act(async () => dots[2]?.click());
    expect(activeTitle()).toBe("Article 3");

    await advance(AUTOPLAY_MS - 1000);
    expect(activeTitle()).toBe("Article 3");
    await advance(1000);
    expect(activeTitle()).toBe("Article 4");
  });

  it("holds the slide while paused and resumes on play", async () => {
    vi.useFakeTimers();
    await render([slide(1), slide(2)]);

    const pause = host.querySelector<HTMLButtonElement>(".home-hero-pause");
    await act(async () => pause?.click());
    expect(pause?.getAttribute("aria-label")).toBe(labels.play);

    await advance(AUTOPLAY_MS);
    expect(activeTitle()).toBe("Article 1");

    await act(async () => pause?.click());
    expect(pause?.getAttribute("aria-label")).toBe(labels.pause);
    await advance(AUTOPLAY_MS);
    expect(activeTitle()).toBe("Article 2");
  });

  it("starts paused when the Reader asked for less motion", async () => {
    vi.spyOn(window, "matchMedia").mockReturnValue({
      matches: true,
      media: "(prefers-reduced-motion: reduce)",
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    } as unknown as MediaQueryList);

    await render([slide(1), slide(2)]);

    expect(host.querySelector(".home-hero-pause")?.getAttribute("aria-label")).toBe(labels.play);
  });
});

describe("the hero's controls", () => {
  it("steps with the arrows and with the keyboard", async () => {
    await render([slide(1), slide(2), slide(3)]);

    const next = host.querySelector<HTMLButtonElement>(".home-hero-arrow--next");
    await act(async () => next?.click());
    expect(activeTitle()).toBe("Article 2");

    const previous = host.querySelector<HTMLButtonElement>(".home-hero-arrow--previous");
    await act(async () => previous?.click());
    expect(activeTitle()).toBe("Article 1");

    const hero = host.querySelector(".home-hero");
    await act(async () => {
      hero?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
    });
    expect(activeTitle()).toBe("Article 3");
  });

  it("does not step out from under a focused title link", async () => {
    await render([slide(1), slide(2), slide(3)]);

    const link = host.querySelector<HTMLAnchorElement>(".home-hero-slide--active .home-hero-title a");
    await act(async () => {
      link?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    });

    expect(activeTitle()).toBe("Article 1");
  });
});
