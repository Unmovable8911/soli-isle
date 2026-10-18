import { readFileSync } from "node:fs";
import path from "node:path";

import type { Metadata } from "next";
import { describe, expect, it } from "vitest";

import * as archivePage from "./archive/page";
import * as feedPage from "./feed/page";
import * as searchPage from "./search/page";

/**
 * The browse surfaces are three pages and one arrangement: a head, then the
 * front page's card grid. Nothing below inspects a rendered page — the pages
 * read the database — so what it holds them to is the wiring: which list
 * component each one draws, and which ones a crawler may not index.
 */
const LOCALE_ROOT = path.resolve(process.cwd(), "src/app/[locale]");

function source(relative: string): string {
  return readFileSync(path.join(LOCALE_ROOT, relative), "utf8");
}

const BROWSE = {
  category: "categories/[[...path]]/page.tsx",
  tag: "tags/[slug]/page.tsx",
  search: "search/page.tsx",
} as const;

describe("the browse surfaces", () => {
  it.each(Object.entries(BROWSE))("%s draws the one shared Article grid", (_surface, file) => {
    const text = source(file);

    expect(text).toContain("<ArticleGrid");
    // A page that reached for the card itself would be the second list this
    // ticket exists to delete.
    expect(text).not.toContain("ArticleCard");
    expect(text).not.toContain("reader-list");
  });

  it("counts the search results in the page head, even when the count is zero", () => {
    const text = source(BROWSE.search);
    // The head counts what is below it on every browse surface, Search
    // included: a zero is a result, not a reason to say nothing.
    expect(text).toMatch(/<ReaderPageHead[\s\S]*?count=\{/);
  });

  it("gives the Category page its child-Category pills", () => {
    expect(source(BROWSE.category)).toContain("<CategoryPills");
  });

  it("keeps the Archive an index of months rather than a fourth grid", () => {
    const text = source("archive/page.tsx");

    expect(text).toContain("<ArchiveIndex");
    expect(text).not.toContain("ArticleGrid");
    expect(text).not.toContain("ArticleCard");
  });
});

type MetadataSource = {
  generateMetadata: (input: { params: Promise<{ locale: string }> }) => Promise<Metadata>;
};

const NOINDEX: readonly (readonly [string, MetadataSource])[] = [
  ["archive", archivePage],
  ["search", searchPage],
  ["feed", feedPage],
];

describe("the pages a crawler may not index", () => {
  it.each(NOINDEX)("%s says so in its metadata", async (_page, module) => {
    const metadata = await module.generateMetadata({ params: Promise.resolve({ locale: "en" }) });
    const robots = metadata.robots;

    // Next also accepts the directive as a raw string; what matters is that the
    // page says "do not index" in whichever form it chose.
    expect(typeof robots === "string" ? undefined : robots?.index).toBe(false);
  });
});
