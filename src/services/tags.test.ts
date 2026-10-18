import { afterEach, describe, expect, it } from "vitest";

import { createArticleContext, type ArticleContext } from "@/services/articles";
import { createAssetContext } from "@/services/assets";
import { createTagContext, createTag, listTags } from "@/services/tags";
import { createTestHarness, type TestHarness } from "@/test/harness";

const harnesses: TestHarness[] = [];

async function createFixture(): Promise<{ harness: TestHarness; articles: ArticleContext }> {
  const harness = await createTestHarness();
  harnesses.push(harness);
  const assets = createAssetContext(harness.database, harness.clock, harness.resources.rootDir);
  return {
    harness,
    articles: createArticleContext(harness.database, harness.clock, assets),
  };
}

afterEach(async () => {
  for (const harness of harnesses.splice(0)) {
    await harness.close();
  }
});

describe("tags", () => {
  it("creates a tag with a slug derived from its name", async () => {
    const { articles } = await createFixture();

    const outcome = await createTag(articles, { locale: "zh", name: "Type Script" });

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.tag).toMatchObject({ slug: "type-script", names: { zh: "Type Script" } });
  });

  it("adds a second locale name to an existing tag slug", async () => {
    const { articles } = await createFixture();
    const created = await createTag(articles, { locale: "zh", name: "技术" });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const same = await createTag(articles, {
      slug: created.tag.slug,
      locale: "en",
      name: "Tech",
    });

    expect(same.ok).toBe(true);
    if (!same.ok) return;
    expect(same.tag.names).toEqual({ zh: "技术", en: "Tech" });
  });

  it("rejects a tag without a name", async () => {
    const { articles } = await createFixture();

    await expect(createTag(articles, { locale: "zh", name: " " })).resolves.toEqual({
      ok: false,
      reason: "invalid-name",
    });
  });

  it("lists tags alphabetically", async () => {
    const { articles } = await createFixture();
    await createTag(articles, { locale: "zh", name: "beta" });
    await createTag(articles, { locale: "zh", name: "alpha" });

    const tags = await listTags(createTagContext(articles.database, articles.clock));

    expect(tags.map((tag) => tag.slug)).toEqual(["alpha", "beta"]);
  });
});
