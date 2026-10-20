import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * The Home page is the only surface that knows about `?category` and `?page`,
 * so what it has to get right is the wiring: the whole Article set and the
 * Category tree handed to one component, the query string resolved to a
 * Category path and a page number, and no cap of its own anywhere in between.
 *
 * How a query param is read — which value a repeated param carries, and which
 * path a Category selector resolves to — is domain logic and is executed in
 * ../../domain/home-listing.test.ts. Nothing here asserts that shape.
 *
 * Nothing below renders the page — it reads the database — so the source text
 * is the artefact under test, exactly as in ./browse-pages.test.ts.
 */
const LOCALE_ROOT = path.resolve(process.cwd(), "src/app/[locale]");

function source(): string {
  return readFileSync(path.join(LOCALE_ROOT, "page.tsx"), "utf8");
}

/** The argument list of one call, so a cap cannot hide inside it. */
function callArguments(text: string, call: string): string {
  const start = text.indexOf(call);
  expect(start, `${call} is not called`).toBeGreaterThanOrEqual(0);
  const open = text.indexOf("(", start);
  const close = text.indexOf(")", open);
  return text.slice(open + 1, close);
}

/** The `<ReaderHome ... />` element, so a prop cannot be handed to something else. */
function readerHomeElement(text: string): string {
  const start = text.indexOf("<ReaderHome");
  expect(start, "<ReaderHome is not drawn").toBeGreaterThanOrEqual(0);
  return text.slice(start, text.indexOf("/>", start));
}

/** The variable the page keeps the awaited query string in. */
function queryVariable(text: string): string {
  const awaited = /const\s+(\w+)\s*=\s*await\s+searchParams/.exec(text);
  expect(awaited?.[1], "the page never awaits searchParams").toBeDefined();
  return awaited?.[1] ?? "";
}

describe("the Home listing", () => {
  it("reads the query string off the page props and awaits it", () => {
    const text = source();

    expect(text).toMatch(/searchParams\s*:\s*Promise</);
    expect(text).toMatch(/category\?:\s*string\s*\|\s*string\[\]/);
    expect(text).toMatch(/page\?:\s*string\s*\|\s*string\[\]/);
    expect(queryVariable(text)).not.toBe("");
  });

  it("asks for every Article and the Category tree in one round trip", () => {
    const text = source();
    const together = /Promise\.all\(\[([\s\S]*?)\]\)/.exec(text)?.[1] ?? "";

    // Two lookups off the same request, not two waits.
    expect(together).toContain("listRecentArticles");
    expect(together).toContain("listReaderCategories");
  });

  it("lists the Articles without a limit", () => {
    const text = source();

    // A cap anywhere in the call — a literal or a shared component constant —
    // is the hero-plus-twenty listing this page no longer shows.
    expect(callArguments(text, "listRecentArticles(")).not.toContain("limit");
    expect(text).not.toContain("HOME_LIMIT");
    expect(text).not.toContain("HOME_GRID_LIMIT");
    expect(text).toMatch(/import \{ ReaderHome \} from "@\/components\/reader-home"/);
  });

  it("hands ReaderHome the Article set, the tree, the Category and the page", () => {
    const element = readerHomeElement(source());

    expect(element).toMatch(/\barticles=\{/);
    expect(element).toMatch(/\bcategories=\{/);
    expect(element).toMatch(/\blocale=\{/);
    expect(element).toMatch(/\bcategoryPath=\{/);
    expect(element).toMatch(/\bpage=\{/);
  });

  it("passes the requested page straight through, unclamped", () => {
    const text = source();

    // An out-of-range page is the component's to resolve; the page that clamps
    // here would be the second place deciding which page is shown.
    expect(readerHomeElement(text)).toContain(`page={parsePageNumber(${queryVariable(text)}.page)}`);
    expect(text).not.toMatch(/Math\.(min|max)/);
  });

  it("resolves ?category against the tree it was handed, through the domain helper", () => {
    const text = source();
    const element = readerHomeElement(text);

    expect(text).toMatch(/import \{ resolveCategoryPath \} from "@\/domain\/home-listing"/);
    // The tree's own paths go in, so the helper can only answer with an entry
    // the reader was actually shown in the filter.
    expect(element).toContain("categoryPath={resolveCategoryPath(");
    expect(element).toContain("categories.map((category) => category.path)");
    expect(element).toMatch(new RegExp(`\\b${queryVariable(text)}\\.category\\b`));
  });

  it("keeps no query-string rule of its own", () => {
    const text = source();

    // A Next page may export nothing extra, so a copy of the rule left here
    // would be the one no test executes: it lives in the domain instead.
    expect(text).not.toMatch(/function resolveCategoryPath/);
    expect(text).not.toContain("Array.isArray");
    expect(text).not.toMatch(/typeof raw/);
  });

  it("answers an unknown Category with Latest, never a 404 or a redirect", () => {
    const text = source();

    // The locale is the one thing this page still refuses.
    expect(text.match(/notFound\(\)/g) ?? []).toHaveLength(1);
    expect(text).not.toContain("redirect(");
  });

  it("keeps its shell and its metadata", () => {
    const text = source();

    expect(text).toContain('export const dynamic = "force-dynamic"');
    expect(text).toContain('export const runtime = "nodejs"');
    expect(text).toContain("export async function generateMetadata");
    expect(text).toContain("<main id={MAIN_CONTENT_ID} tabIndex={-1}>");
  });
});
