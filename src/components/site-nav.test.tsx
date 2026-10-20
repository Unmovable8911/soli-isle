import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { messages } from "@/messages";

import { SiteNav } from "./site-nav";

describe("site navigation", () => {
  it("lists Home, the archive and the Feed, not search or the Category index", () => {
    const html = renderToStaticMarkup(<SiteNav locale="en" labels={messages.en.reader.nav} />);

    expect(html).toContain(`aria-label="${messages.en.reader.nav.label}"`);
    for (const href of ["/en", "/en/archive", "/en/feed"]) {
      expect(html).toContain(`href="${href}"`);
    }
    expect(html).not.toContain('href="/en/categories"');
    expect(html).not.toContain('href="/en/search"');
  });

  it("marks Home only at the Locale root, not on every page below it", () => {
    const home = renderToStaticMarkup(
      <SiteNav locale="en" labels={messages.en.reader.nav} currentPath="/en" />,
    );
    expect(home).toMatch(/<a[^>]*aria-current="page"[^>]*>Home<\/a>/);
    expect(home).not.toMatch(/<a[^>]*aria-current="page"[^>]*>Archive<\/a>/);

    const article = renderToStaticMarkup(
      <SiteNav locale="en" labels={messages.en.reader.nav} currentPath="/en/articles/island" />,
    );
    expect(article).not.toMatch(/aria-current="page"[^>]*>Home<\/a>/);
  });

  it("marks the archive below its own address", () => {
    const html = renderToStaticMarkup(
      <SiteNav locale="en" labels={messages.en.reader.nav} currentPath="/en/archive/2026" />,
    );
    expect(html).toMatch(/<a[^>]*aria-current="page"[^>]*>Archive<\/a>/);
  });

  it("speaks the page's Locale", () => {
    const html = renderToStaticMarkup(<SiteNav locale="zh" labels={messages.zh.reader.nav} />);

    expect(html).toContain('aria-label="站点导航"');
    expect(html).toContain(">首页</a>");
  });
});
