import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { messages } from "@/messages";

import { SiteNav } from "./site-nav";

describe("site navigation", () => {
  it("names the navigation after all four of its destinations, not just the Categories", () => {
    const html = renderToStaticMarkup(<SiteNav locale="en" labels={messages.en.reader.nav} />);

    expect(html).toContain(`aria-label="${messages.en.reader.nav.label}"`);
    expect(messages.en.reader.nav.label).not.toBe(messages.en.reader.nav.categories);
    for (const href of ["/en/categories", "/en/archive", "/en/feed", "/en/search"]) {
      expect(html).toContain(`href="${href}"`);
    }
  });

  it("speaks the page's Locale", () => {
    const html = renderToStaticMarkup(<SiteNav locale="zh" labels={messages.zh.reader.nav} />);

    expect(html).toContain('aria-label="站点导航"');
    expect(messages.zh.reader.nav.label).not.toBe(messages.zh.reader.nav.categories);
  });
});
