import { describe, expect, it } from "vitest";

import type { PendingArticleEdit } from "./article-local-store";
import { createArticleSyncTransport } from "./article-sync-transport";

const DRAFT: PendingArticleEdit = {
  articleId: "01J8ZZ",
  locale: "zh",
  title: "Mine",
  summary: "Notes",
  bodyJson: '{"type":"doc"}',
  baseVersion: 1,
  savedAt: "2025-06-15T08:30:00.000Z",
};

const TRANSLATION = {
  locale: "zh",
  title: "Mine",
  summary: "Notes",
  bodyJson: '{"type":"doc"}',
  bodyMarkdown: "",
  createdAt: "2025-06-15T08:00:00.000Z",
  updatedAt: "2025-06-15T08:30:00.000Z",
  version: 2,
};

function transportFor(response: Response) {
  const requests: Array<{ url: string; body: unknown }> = [];
  const transport = createArticleSyncTransport({
    articleId: "01J8ZZ",
    locale: "zh",
    fetchImpl: async (input, init) => {
      requests.push({
        url: String(input),
        body: typeof init?.body === "string" ? JSON.parse(init.body) : null,
      });
      return response;
    },
  });
  return { transport, requests };
}

describe("article sync transport", () => {
  it("sends the base version the edit was derived from", async () => {
    const { transport, requests } = transportFor(
      Response.json({ article: { translations: [TRANSLATION] } }),
    );

    const outcome = await transport.save(DRAFT);

    expect(requests).toEqual([
      {
        url: "/api/admin/articles/01J8ZZ/translations/zh",
        body: {
          baseVersion: 1,
          title: "Mine",
          summary: "Notes",
          bodyJson: '{"type":"doc"}',
        },
      },
    ]);
    expect(outcome).toEqual({
      kind: "saved",
      translation: { version: 2, title: "Mine", summary: "Notes", bodyJson: '{"type":"doc"}' },
    });
  });

  it("reads the refused save's server copy out of a 409", async () => {
    const { transport } = transportFor(
      Response.json(
        { error: "stale-content", current: { ...TRANSLATION, title: "Server copy", version: 4 } },
        { status: 409 },
      ),
    );

    await expect(transport.save(DRAFT)).resolves.toEqual({
      kind: "stale",
      current: { version: 4, title: "Server copy", summary: "Notes", bodyJson: '{"type":"doc"}' },
    });
  });

  it("treats any other failure as unavailable so the local copy stays queued", async () => {
    for (const response of [
      Response.json({ error: "unauthorized" }, { status: 401 }),
      Response.json({ error: "invalid-base-version" }, { status: 400 }),
      Response.json({ error: "stale-content" }, { status: 409 }),
      Response.json({ article: { translations: [] } }),
    ]) {
      const { transport } = transportFor(response);
      await expect(transport.save(DRAFT)).resolves.toEqual({ kind: "unavailable" });
    }
  });

  it("treats a thrown request as unavailable", async () => {
    const transport = createArticleSyncTransport({
      articleId: "01J8ZZ",
      locale: "zh",
      fetchImpl: async () => {
        throw new TypeError("Failed to fetch");
      },
    });

    await expect(transport.save(DRAFT)).resolves.toEqual({ kind: "unavailable" });
  });
});
