import { describe, expect, it } from "vitest";

import { goneResponse } from "./gone";

describe("permanently removed article", () => {
  it("answers 410 with a readable page instead of a bare 404", async () => {
    const response = goneResponse("zh");

    expect(response.status).toBe(410);
    expect(response.headers.get("content-type")).toContain("text/html");

    const body = await response.text();
    expect(body).toContain("已被永久移除");
    expect(body).toContain('lang="zh"');
    expect(body).toContain('href="/zh"');
  });

  it("keeps a removed page out of every index", async () => {
    const response = goneResponse("en");

    expect(response.headers.get("x-robots-tag")).toContain("noindex");
    await expect(response.text()).resolves.toContain('content="noindex"');
  });

  it("speaks the Locale of the URL that was asked for", async () => {
    await expect(goneResponse("en").text()).resolves.toContain("permanently removed");
  });

  it("draws the site's own dead-end page instead of the browser's default", async () => {
    const body = await goneResponse("en").text();

    expect(body).toContain('<section class="empty-state">');
    expect(body).toContain('<p class="empty-state-kicker">410</p>');
    expect(body).toContain('<h1 class="empty-state-title">');
    expect(body).toContain('<div class="empty-state-action">');
    // The document is served from the Edge runtime, which cannot reach the
    // compiled stylesheet or the database, so it carries its own typography.
    expect(body).toContain("<style>");
    expect(body).toContain("/fonts/lora-latin-wght-normal.woff2");
  });

  it("says 410, never the 404 page's copy", async () => {
    const body = await goneResponse("en").text();

    expect(body).toContain("permanently removed");
    expect(body).not.toContain("This page does not exist");
  });
});
