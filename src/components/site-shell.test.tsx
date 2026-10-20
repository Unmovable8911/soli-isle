import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { MAIN_CONTENT_ID } from "@/components/skip-link";
import { messages } from "@/messages";

import { SiteShell } from "./site-shell";

// The bar reads the pathname the same way LocaleSwitcher does: a client
// component rendered by the layout, so the server-rendered HTML already carries
// the marker and a Reader without JavaScript still sees where they are.
vi.mock("next/navigation", () => ({
  usePathname: () => "/en/archive",
  useSearchParams: () => new URLSearchParams(),
}));

function render(locale: "en" | "zh" = "en"): string {
  const t = messages[locale];
  return renderToStaticMarkup(
    <SiteShell locale={locale} chrome={t.chrome} nav={t.reader.nav} search={t.reader.search}>
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

  it("puts the sections in the bar and in the mobile drawer, with no side rail", () => {
    const html = render();

    expect(html).not.toContain('class="site-rail"');
    expect(html).not.toContain('class="site-tree"');
    expect(html).toContain('class="site-topbar-nav"');
    expect(html).toContain('class="site-menu-panel"');

    const navs = html.match(/<nav class="site-nav"[\s\S]*?<\/nav>/g) ?? [];
    expect(navs).toHaveLength(2);
    for (const nav of navs) {
      expect(nav).toContain('href="/en"');
      expect(nav).toContain('href="/en/archive"');
      expect(nav).toContain('href="/en/feed"');
      expect(nav).not.toContain('href="/en/categories"');
      expect(nav).not.toContain('href="/en/search"');
    }

    const footer = html.match(/<footer[\s\S]*?<\/footer>/)?.[0] ?? "";
    expect(footer).toContain('href="/en/archive"');
    expect(footer).toContain('href="/en/feed"');
    expect(footer).not.toContain('href="/en/categories"');
    expect(footer).not.toContain('href="/en/search"');
  });

  it("opens the mobile menu closed, with no script to reopen it", () => {
    const html = render();

    expect(html).toMatch(/<details class="site-menu">/);
    expect(html).not.toMatch(/<details[^>]*\sopen\b/);
    expect(html).not.toContain("onClick");
  });

  it("marks the current section in both copies of the navigation", () => {
    const html = render();

    // The Locale switcher marks itself the same way, so the section's markers
    // are the ones that wrap a navigation label.
    const marked = html.match(/<a[^>]*aria-current="page"[^>]*>Archive<\/a>/g) ?? [];
    expect(marked).toHaveLength(2);
    for (const anchor of marked) {
      expect(anchor).toContain('href="/en/archive"');
    }
    expect(html).not.toMatch(/<a[^>]*aria-current="page"[^>]*>Home<\/a>/);
    expect(html).not.toMatch(/<a[^>]*aria-current="page"[^>]*>Feed<\/a>/);
  });

  it("puts the language picker and the theme button in the bar and in the drawer", () => {
    const html = render();

    const locales = html.match(/<details class="site-locale-menu">/g) ?? [];
    const themes = html.match(/class="theme-toggle"/g) ?? [];
    expect(locales).toHaveLength(2);
    expect(themes).toHaveLength(2);
    expect(html).toContain(`${messages.en.chrome.switchLocaleLabel}: English`);
    expect(html).toContain(`aria-label="${messages.en.chrome.themeLabel}: System"`);
  });

  it("orders the tab stops skip link, then top bar, then the page body", () => {
    const html = render();

    const skip = html.indexOf('class="skip-link"');
    const topbar = html.indexOf('class="site-topbar"');
    const body = html.indexOf("<main");

    expect(skip).toBeGreaterThanOrEqual(0);
    expect(skip).toBeLessThan(topbar);
    expect(topbar).toBeLessThan(body);
  });

  it("word-marks the bar and the footer back to the Locale home", () => {
    const html = render("zh");
    const bar = html.match(/<header class="site-topbar"[^>]*>[\s\S]*?<\/header>/)?.[0] ?? "";
    const footer = html.match(/<footer[^>]*>[\s\S]*?<\/footer>/)?.[0] ?? "";

    // The wordmark moved from the rail into the bar in the editorial refresh;
    // the footer repeats it as the page's sign-off.
    expect(bar).toContain('class="site-brand"');
    expect(bar).toContain(`href="/zh"`);
    expect(bar).toContain(messages.zh.chrome.siteName);
    expect(footer).toContain('class="site-footer-brand"');
    expect(footer).toContain(`href="/zh"`);
    expect(footer).toContain(messages.zh.chrome.footer.tagline);
  });
});
