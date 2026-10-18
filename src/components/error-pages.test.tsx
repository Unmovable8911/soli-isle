import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ErrorView } from "./error-view";
import { NotFoundView } from "./not-found-view";
import { requestLocale } from "./request-locale";

/**
 * The three dead ends. Each one is a real page in the site's own visual
 * language, each one says "do not index me", and each one states which dead end
 * it is: a 404 is an address that was never here, a 410 is a work that was here
 * and is not coming back.
 */
describe("the 404 page", () => {
  it("is a real page: the shell's main, the site's heading, and a way home", () => {
    const html = renderToStaticMarkup(<NotFoundView locale="zh" />);

    expect(html).toContain('<main id="main-content" tabindex="-1">');
    expect(html).toContain('<p class="empty-state-kicker">404</p>');
    expect(html).toContain("这一页不存在");
    expect(html).toContain("返回首页");
    expect(html).toContain('href="/zh"');
  });

  it("keeps itself out of every index", () => {
    const html = renderToStaticMarkup(<NotFoundView locale="en" />);
    expect(html).toContain('<meta name="robots" content="noindex"');
  });

  it("speaks the Locale of the address that was asked for", () => {
    expect(renderToStaticMarkup(<NotFoundView locale="en" />)).toContain("This page does not exist");
  });
});

describe("the error page", () => {
  it("is the site's page, names the failure, and offers the retry", () => {
    const html = renderToStaticMarkup(<ErrorView locale="en" onRetry={() => {}} />);

    expect(html).toContain('<main id="main-content" tabindex="-1">');
    expect(html).toContain('<p class="empty-state-kicker">500</p>');
    expect(html).toContain("This page did not render");
    expect(html).toContain('<button type="button" class="empty-state-retry">Try again</button>');
  });

  it("keeps itself out of every index", () => {
    expect(renderToStaticMarkup(<ErrorView locale="zh" onRetry={() => {}} />)).toContain(
      '<meta name="robots" content="noindex"',
    );
  });
});

describe("choosing the Locale for a page that has no params", () => {
  it("takes the Locale the middleware saw in the address", () => {
    expect(requestLocale("zh")).toBe("zh");
    expect(requestLocale("en")).toBe("en");
  });

  it("falls back to the site's default rather than guessing", () => {
    expect(requestLocale(null)).toBe("zh");
    expect(requestLocale("fr")).toBe("zh");
    expect(requestLocale("")).toBe("zh");
  });
});
