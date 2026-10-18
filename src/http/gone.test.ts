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
});
