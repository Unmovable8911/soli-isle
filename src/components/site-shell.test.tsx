import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { MAIN_CONTENT_ID } from "@/components/skip-link";
import { messages } from "@/messages";
import type { ReaderCategoryNode } from "@/services/reading";

import { SiteShell } from "./site-shell";

// The rail reads the pathname the same way LocaleSwitcher does: a client
// component rendered by the layout, so the server-rendered HTML already carries
// the marker and a Reader without JavaScript still sees where they are.
vi.mock("next/navigation", () => ({
  usePathname: () => "/en/categories/tech",
  useSearchParams: () => new URLSearchParams(),
}));

const TREE: ReaderCategoryNode[] = [
  {
    id: "01",
    slug: "tech",
    path: "tech",
    name: "Technology",
    count: 2,
    children: [
      { id: "02", slug: "web", path: "tech/web", name: "Web Development", count: 1, children: [] },
    ],
  },
];

function render(locale: "en" | "zh" = "en"): string {
  const t = messages[locale];
  return renderToStaticMarkup(
    <SiteShell
      locale={locale}
      chrome={t.chrome}
      nav={t.reader.nav}
      search={t.reader.search}
      categoriesHeading={t.reader.category.heading}
      categories={TREE}
    >
      <main id={MAIN_CONTENT_ID} tabIndex={-1}>
        The page body
      </main>
    </SiteShell>,
  );
}

describe("the public shell", () => {
  it("searches the Locale the Reader is in, with a plain GET form and the field the search page reads", () => {
    const html = render();
    const form = html.match(/<form[^>]*class="site-search"[^>]*>/)?.[0] ?? "";

    expect(form).toContain('action="/en/search"');
    expect(form).toContain('method="get"');
    // No handler, so the form is the browser's: pressing Enter navigates even
    // with JavaScript disabled.
    expect(form).not.toMatch(/\son[a-z]+=/i);
    expect(html).toContain('name="q"');
    expect(html).toContain(`placeholder="${messages.en.reader.search.placeholder}"`);
  });

  it("keeps the search form in the top bar, and the top bar free of anything a page must carry", () => {
    const html = render();

    const header = html.match(/<header[^>]*>[\s\S]*?<\/header>/)?.[0] ?? "";
    expect(header).toContain('class="site-search"');
    expect(header).not.toContain("<main");
  });

  it("puts the same navigation, tree and bottom controls in the rail and in the mobile drawer", () => {
    const html = render();

    expect(html).toContain('class="site-rail"');
    expect(html).toContain(`aria-label="${messages.en.reader.nav.label}"`);
    expect(html).toContain(`aria-label="${messages.en.chrome.themeLabel}"`);
    expect(html.match(/class="site-tree"/g)?.length).toBeGreaterThanOrEqual(2);
    for (const href of ["/en/categories", "/en/archive", "/en/feed", "/en/search"]) {
      expect(html.split(`href="${href}"`).length - 1, href).toBeGreaterThanOrEqual(2);
    }
  });

  it("opens the mobile menu closed, with no script to reopen it", () => {
    const html = render();

    expect(html).toMatch(/<details class="site-menu">/);
    expect(html).not.toMatch(/<details[^>]*\sopen\b/);
    expect(html).not.toContain("onClick");
  });

  it("marks the current Category in both copies of the tree", () => {
    const html = render();

    // The Locale switcher marks itself the same way, so the tree's markers are
    // the ones that wrap a Category name.
    const marked = html.match(/<a[^>]*aria-current="page"[^>]*>Technology<\/a>/g) ?? [];
    expect(marked).toHaveLength(2);
    for (const anchor of marked) {
      expect(anchor).toContain('href="/en/categories/tech"');
    }
    expect(html).not.toMatch(/<a[^>]*aria-current="page"[^>]*>Web Development/);
  });

  it("orders the tab stops skip link, then top bar, then rail, then the page body", () => {
    const html = render();

    const skip = html.indexOf('class="skip-link"');
    const topbar = html.indexOf('class="site-topbar"');
    const rail = html.indexOf('class="site-rail"');
    const body = html.indexOf("<main");

    expect(skip).toBeGreaterThanOrEqual(0);
    expect(skip).toBeLessThan(topbar);
    expect(topbar).toBeLessThan(rail);
    expect(rail).toBeLessThan(body);
  });

  it("word-marks the rail back to the Locale home", () => {
    const html = render("zh");
    const rail = html.match(/<aside[^>]*>[\s\S]*?<\/aside>/)?.[0] ?? "";

    expect(rail).toContain(`href="/zh"`);
    expect(rail).toContain(messages.zh.chrome.siteName);
  });
});
