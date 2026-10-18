import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { messages } from "@/messages";

import { SiteNav } from "./site-nav";

describe("site navigation", () => {
  it("lists only the archive and the Feed, not search or the Category index", () => {
    const html = renderToStaticMarkup(<SiteNav locale="en" labels={messages.en.reader.nav} />);

    expect(html).toContain(`aria-label="${messages.en.reader.nav.label}"`);
    for (const href of ["/en/archive", "/en/feed"]) {
      expect(html).toContain(`href="${href}"`);
    }
    expect(html).not.toContain('href="/en/categories"');
    expect(html).not.toContain('href="/en/search"');
  });

  it("speaks the page's Locale", () => {
    const html = renderToStaticMarkup(<SiteNav locale="zh" labels={messages.zh.reader.nav} />);

    expect(html).toContain('aria-label="站点导航"');
  });
});
