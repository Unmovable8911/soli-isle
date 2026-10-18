import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { MAIN_CONTENT_ID, SkipLink } from "./skip-link";

function render(markup: React.ReactElement): string {
  return renderToStaticMarkup(markup);
}

const LOCALE_ROOT = path.resolve(process.cwd(), "src/app/[locale]");

function publicPageFiles(directory: string): string[] {
  return readdirSync(directory, { recursive: true, encoding: "utf8" })
    .map((entry) => path.join(directory, entry))
    .filter((file) => file.endsWith("page.tsx"));
}

describe("the skip link", () => {
  it("is the first thing a keyboard reaches and points at the main region", () => {
    const html = render(<SkipLink label="跳到正文" />);

    expect(html).toContain('class="skip-link"');
    expect(html).toContain(`href="#${MAIN_CONTENT_ID}"`);
    expect(html).toContain("跳到正文");
  });

  it("names a target every public page actually carries", () => {
    const pages = publicPageFiles(LOCALE_ROOT);
    expect(pages.length).toBeGreaterThanOrEqual(7);

    for (const file of pages) {
      const source = readFileSync(file, "utf8");
      const mains = source.match(/<main\b/g) ?? [];
      const targets = source.match(/id=\{MAIN_CONTENT_ID\}/g) ?? [];
      expect(mains.length, `${path.relative(process.cwd(), file)} has no <main>`).toBeGreaterThan(0);
      // A page may render more than one main region (the Category index does);
      // every one of them has to be a possible target.
      expect(targets.length, `${path.relative(process.cwd(), file)} is not skippable`).toBe(
        mains.length,
      );
      expect(source, `${path.relative(process.cwd(), file)} cannot receive focus`).toContain(
        "tabIndex={-1}",
      );
    }
  });
});
