import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * The stylesheets are the whole visual contract, so these assertions read them
 * as data: tokens.css alone owns the palette and the theme must carry real
 * WCAG contrast, the rules in every layer must draw a control boundary from a
 * proven token, and no animation may escape the reduced-motion switch. Parsing
 * the files (rather than importing values) is what makes the test fail when
 * someone edits a colour literal for looks.
 *
 * globals.css is the entry: it only imports, and its import list is the
 * cascade. Everything below reads that list, so a stylesheet added to the
 * layer stack is audited without anyone remembering to register it here.
 */
const STYLES = path.resolve(process.cwd(), "src/app");
const ENTRY = path.join(STYLES, "globals.css");

function importsOf(file: string): string[] {
  return [...readFileSync(file, "utf8").matchAll(/@import\s+"([^"]+)"\s*;/g)].map(
    (match) => match[1] ?? "",
  );
}

const ENTRY_SOURCE = readFileSync(ENTRY, "utf8");
const IMPORTS = importsOf(ENTRY);
const STYLESHEETS = IMPORTS.map((specifier) => path.resolve(STYLES, specifier));

/** The imported layers, concatenated in cascade order. */
const CSS = STYLESHEETS.map((file) => readFileSync(file, "utf8")).join("\n");

/** tokens.css is the only file allowed to declare a colour, so it is read alone. */
const TOKENS = readFileSync(path.join(STYLES, "tokens.css"), "utf8");

/** Comments are prose, not rules; drop them so no prelude starts with a story. */
const SOURCE = CSS.replace(/\/\*[\s\S]*?\*\//g, "");

const THEMES = {
  light: ":root",
  dark: ':root[data-theme="dark"]',
} as const;

type Theme = keyof typeof THEMES;

/** Body text, secondary text and link text: WCAG 1.4.3, normal text. */
const TEXT_MIN = 4.5;
/** Focus rings and the boundary of a control: WCAG 1.4.11. */
const UI_MIN = 3;

interface TokenPair {
  foreground: string;
  background: string;
  min: number;
  use: string;
}

const TOKEN_PAIRS: readonly TokenPair[] = [
  { foreground: "fg", background: "bg", min: TEXT_MIN, use: "body text" },
  { foreground: "muted", background: "bg", min: TEXT_MIN, use: "secondary text" },
  { foreground: "accent", background: "bg", min: TEXT_MIN, use: "link text and the focus ring" },
  { foreground: "on-accent", background: "accent", min: TEXT_MIN, use: "label on a filled control" },
  { foreground: "fg", background: "surface", min: TEXT_MIN, use: "body text on a card" },
  { foreground: "muted", background: "surface", min: TEXT_MIN, use: "secondary text on a card" },
  { foreground: "border-strong", background: "bg", min: UI_MIN, use: "control boundary" },
];

/**
 * The eight roles, in the order tokens.css declares them. A role is only as
 * good as its measurement, so this list and TOKEN_PAIRS are deliberately
 * different tables: one proves a token is a colour, the other proves it is a
 * `readable` colour.
 */
const TOKEN_ROLES = [
  "--bg",
  "--surface",
  "--fg",
  "--muted",
  "--border",
  "--border-strong",
  "--accent",
  "--on-accent",
] as const;

/** Every `{ … }` body in one stylesheet, with the selector (or at-rule) it answers to. */
function rulesIn(source: string): { prelude: string; body: string }[] {
  const found: { prelude: string; body: string }[] = [];
  for (let index = 0; index < source.length; index += 1) {
    if (source[index] !== "{") {
      continue;
    }
    let start = index - 1;
    while (start >= 0 && !"{};".includes(source[start] ?? "")) {
      start -= 1;
    }
    let depth = 0;
    let end = source.length - 1;
    for (let scan = index; scan < source.length; scan += 1) {
      if (source[scan] === "{") {
        depth += 1;
      } else if (source[scan] === "}") {
        depth -= 1;
        if (depth === 0) {
          end = scan;
          break;
        }
      }
    }
    found.push({ prelude: source.slice(start + 1, index).trim(), body: source.slice(index + 1, end) });
  }
  return found;
}

function rules(): { prelude: string; body: string }[] {
  return rulesIn(SOURCE);
}

/** Tokens are read from tokens.css alone: the palette has exactly one home. */
const TOKEN_SOURCE = TOKENS.replace(/\/\*[\s\S]*?\*\//g, "");
const TOKEN_RULES = rulesIn(TOKEN_SOURCE);

/**
 * Every declaration that applies to `selector` — alone, in a selector list, or
 * inside an at-rule. A selector may be styled by more than one rule (a base rule
 * plus a later additive one), so the bodies are joined and the last write wins,
 * exactly as the cascade does.
 */
function blockBody(selector: string): string {
  const bodies: string[] = [];
  for (const rule of rules()) {
    const inList =
      !rule.prelude.startsWith("@") &&
      rule.prelude.split(",").map((part) => part.trim()).includes(selector);
    if (rule.prelude === selector || inList) {
      bodies.push(rule.body);
    }
  }
  if (bodies.length === 0) {
    throw new Error(`globals.css has no rule for ${selector}`);
  }
  return bodies.join("\n");
}

function declarations(body: string): Map<string, string> {
  const found = new Map<string, string>();
  for (const match of body.matchAll(/([a-z-]+)\s*:\s*([^;]+);/g)) {
    const [, property, value] = match;
    if (property !== undefined && value !== undefined) {
      found.set(property, value.trim());
    }
  }
  return found;
}

function themeTokens(theme: Theme): Map<string, string> {
  const body = TOKEN_RULES.find((rule) => rule.prelude === THEMES[theme])?.body;
  if (body === undefined) {
    throw new Error(`tokens.css has no ${THEMES[theme]} block`);
  }
  const tokens = new Map<string, string>();
  for (const match of body.matchAll(/(--[a-z-]+)\s*:\s*([^;]+);/g)) {
    const [, name, value] = match;
    if (name !== undefined && value !== undefined) {
      tokens.set(name, value.trim());
    }
  }
  return tokens;
}

function channelValue(component: number): number {
  const ratio = component / 255;
  return ratio <= 0.03928 ? ratio / 12.92 : ((ratio + 0.055) / 1.055) ** 2.4;
}

/** WCAG 2.1 relative luminance of an `#rrggbb` colour. */
function relativeLuminance(hex: string): number {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (match === null) {
    throw new Error(`not an #rrggbb colour: ${hex}`);
  }
  const [red, green, blue] = match.slice(1).map((part) => channelValue(Number.parseInt(part ?? "", 16)));
  return 0.2126 * (red ?? 0) + 0.7152 * (green ?? 0) + 0.0722 * (blue ?? 0);
}

function contrastRatio(first: string, second: string): number {
  const one = relativeLuminance(first);
  const other = relativeLuminance(second);
  const lighter = Math.max(one, other);
  const darker = Math.min(one, other);
  return (lighter + 0.05) / (darker + 0.05);
}

function measured(theme: Theme, pair: TokenPair): number {
  const tokens = themeTokens(theme);
  const foreground = tokens.get(`--${pair.foreground}`);
  const background = tokens.get(`--${pair.background}`);
  if (foreground === undefined || background === undefined) {
    throw new Error(`${theme} is missing --${pair.foreground} or --${pair.background}`);
  }
  return contrastRatio(foreground, background);
}

describe("the stylesheet layers", () => {
  it("keeps the entry to imports alone, in cascade order", () => {
    const leftover = ENTRY_SOURCE.replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/@import\s+"[^"]+"\s*;/g, "")
      .trim();
    expect(leftover).toBe("");
    expect(IMPORTS.length).toBeGreaterThan(1);

    // Palette first, then the reset, then the reading surfaces, then the console.
    expect(path.basename(IMPORTS[0] ?? "")).toBe("tokens.css");
    expect(path.basename(IMPORTS[1] ?? "")).toBe("base.css");
    const reader = IMPORTS.findIndex((specifier) => specifier.startsWith("./reader/"));
    const admin = IMPORTS.findIndex((specifier) => specifier.startsWith("./admin/"));
    expect(reader, "globals.css imports no reader layer").toBeGreaterThan(1);
    expect(admin, "globals.css imports no admin layer").toBeGreaterThan(reader);
  });

  it("never imports the palette twice", () => {
    expect(IMPORTS.filter((specifier) => specifier.endsWith("tokens.css"))).toHaveLength(1);
  });
});

describe("the contrast maths", () => {
  it("agrees with the published WCAG reference values", () => {
    // Independent source of truth: WCAG 2.1 relative luminance and the classic
    // #767676-on-white AA boundary example.
    expect(contrastRatio("#ffffff", "#000000")).toBeCloseTo(21, 5);
    expect(contrastRatio("#767676", "#ffffff")).toBeCloseTo(4.54, 2);
    expect(contrastRatio("#ffffff", "#ffffff")).toBeCloseTo(1, 5);
  });
});

describe.each(Object.keys(THEMES) as Theme[])("the %s theme", (theme) => {
  it("defines every role as a six-digit hex token", () => {
    const tokens = themeTokens(theme);
    for (const name of TOKEN_ROLES) {
      expect(tokens.get(name), `${theme} ${name}`).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it.each(TOKEN_PAIRS)(
    "reaches $min:1 for $use ($foreground on $background)",
    (pair) => {
      const ratio = measured(theme, pair);
      expect(ratio, `${theme}: --${pair.foreground} on --${pair.background} = ${ratio.toFixed(2)}:1`)
        .toBeGreaterThanOrEqual(pair.min);
    },
  );
});

/** A shape only a control may draw: text fields, the writing surfaces. */
const CONTROL_BORDERS = [
  ".post-composer-surface",
  ".article-editor-content",
  ".reader-search-form input",
  ".post-composer-inline input",
  ".admin-login-form input",
  ".article-callout-tone select",
] as const;

/**
 * Cards, chips and section rules: the decorative hairline. It is deliberately
 * under 3:1 — that is what a hairline is — so a card that reached for
 * --border-strong would shout every box on the page.
 */
const DECORATIVE_BORDERS = [
  ".post-card",
  ".post-tag",
  ".article-meta",
  ".asset-card",
  ".article-preview",
  ".article-locales a",
  ".reader-article-nav a",
  ".article-body details",
] as const;

describe("control boundaries", () => {
  it.each(CONTROL_BORDERS)("%s draws its border from the control boundary token", (selector) => {
    const border = declarations(blockBody(selector)).get("border");
    expect(border, selector).toBeDefined();
    // A diluted mix is how a boundary ends up under 3:1 without anyone noticing.
    expect(border, selector).not.toContain("color-mix");
    // Only --border-strong is measured at 3:1. Accepting --border here would let
    // the 1.22:1 hairline become an input's edge without failing a single test.
    expect(border, selector).toMatch(/var\(--border-strong\)/);
  });

  it.each(DECORATIVE_BORDERS)("%s draws only the decorative hairline", (selector) => {
    const border = declarations(blockBody(selector)).get("border");
    expect(border, selector).toBeDefined();
    expect(border, selector).toMatch(/var\(--border\)/);
  });
});

/** Rules that remove the browser's own ring must put one back. */
describe("visible focus", () => {
  it("offers one global focus ring on the accent token", () => {
    const ring = declarations(blockBody(":focus-visible"));
    expect(ring.get("outline")).toContain("var(--accent)");
    expect(Number.parseFloat(ring.get("outline-offset") ?? "0")).toBeGreaterThanOrEqual(2);
  });

  it("puts the gallery cell's ring on the cell, where the crop cannot hide it", () => {
    const ring = declarations(blockBody(".post-gallery-cell:focus-within"));
    expect(ring.get("outline")).toContain("var(--accent)");
  });

  it("replaces every removed outline with a focus-visible ring", () => {
    for (const match of SOURCE.matchAll(/([^{}]+)\{([^{}]*outline:\s*(?:none|0)[^{}]*)\}/g)) {
      const selectors = (match[1] ?? "").trim();
      for (const selector of selectors.split(",").map((part) => part.trim())) {
        const replacement = declarations(blockBody(`${selector}:focus-visible`));
        expect(replacement.get("outline"), `${selector} removes the ring without replacing it`).toContain(
          "var(--accent)",
        );
      }
    }
  });
});

/**
 * The other half of the contrast proof: text colour may only come from the
 * audited tokens, so no rule can quietly paint text in a raw or diluted colour
 * that the ratio table above never sees.
 */
describe("text colour", () => {
  const ALLOWED = new Set([
    "var(--bg)",
    "var(--surface)",
    "var(--fg)",
    "var(--muted)",
    "var(--accent)",
    "var(--on-accent)",
    "inherit",
    "currentColor",
    "transparent",
  ]);

  it("only ever names a theme token", () => {
    const offenders: string[] = [];
    for (const rule of rules()) {
      const colour = declarations(rule.body).get("color");
      if (colour !== undefined && !ALLOWED.has(colour.trim())) {
        offenders.push(`${rule.prelude} { color: ${colour} }`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

/**
 * Token ownership, the other direction: a colour literal outside tokens.css is
 * a decision the ratio table can never see. Comments are prose and are dropped
 * first, so a hex value quoted in a note is not mistaken for a declaration.
 */
const LITERAL = /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|oklch|lab|lch|color)\(/gi;

describe("colour literals", () => {
  const layered = STYLESHEETS.filter((file) => path.resolve(file) !== path.join(STYLES, "tokens.css"));

  it.each(layered.map((file) => [path.relative(STYLES, file), file] as const))(
    "%s declares no colour of its own",
    (name, file) => {
      const source = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
      const offenders = [...source.matchAll(LITERAL)].map((match) => match[0]);
      expect(offenders, name).toEqual([]);
    },
  );
});

/** Controls a thumb has to hit on a 360–430px phone. */
const READER_CONTROLS = [
  "header a",
  "header button",
  ".post-expand",
  ".feed-more-button",
  ".post-tag",
  ".lightbox-close",
  ".lightbox-previous",
  ".lightbox-next",
  ".reader-tags a",
] as const;

/** Reader surfaces that render at phone width; 0.875rem is the 14px floor. */
const READER_TEXT = [
  ".post-time",
  ".post-gallery-counter",
  ".post-tag",
  ".reader-tags",
] as const;

describe("phone width", () => {
  it("wraps a long unbroken string instead of pushing the page sideways", () => {
    for (const selector of [".article-body", ".post-body"]) {
      expect(declarations(blockBody(selector)).get("overflow-wrap"), selector).toBe("anywhere");
    }
  });

  it("scrolls a code block inside its own box", () => {
    expect(declarations(blockBody(".post-body pre")).get("overflow-x")).toBe("auto");
  });

  it.each(READER_CONTROLS)("%s is a 44px box for a thumb", (selector) => {
    const rule = blockBody(selector);
    expect(rule, selector).toContain("min-height: 2.75rem");
  });

  it.each(READER_TEXT)("%s stays at or above the 14px reading floor", (selector) => {
    const size = declarations(blockBody(selector)).get("font-size") ?? "0rem";
    expect(Number.parseFloat(size), `${selector} is ${size}`).toBeGreaterThanOrEqual(0.875);
  });
});

/** The stack of at-rule preludes enclosing a position in the stylesheet. */
function enclosingAtRules(index: number): string[] {
  const stack: string[] = [];
  let prelude = "";
  for (let position = 0; position < index; position += 1) {
    const character = SOURCE[position];
    if (character === "{") {
      stack.push(prelude.trim());
      prelude = "";
    } else if (character === "}") {
      stack.pop();
      prelude = "";
    } else if (character === ";") {
      prelude = "";
    } else {
      prelude += character;
    }
  }
  return stack.filter((entry) => entry.startsWith("@"));
}

const NO_PREFERENCE = "@media (prefers-reduced-motion: no-preference)";
const REDUCE = "@media (prefers-reduced-motion: reduce)";

describe("reduced motion", () => {
  it("keeps every transition and animation behind a motion query", () => {
    const motion = /(?:transition|animation)(?:-[a-z]+)?\s*:/g;
    const offenders: string[] = [];
    for (const match of SOURCE.matchAll(motion)) {
      const atRules = enclosingAtRules(match.index ?? 0);
      // A declaration is safe when it can only apply without the preference, or
      // when it *is* the neutraliser the preference switches on.
      if (atRules.includes(NO_PREFERENCE) || atRules.includes(REDUCE)) {
        continue;
      }
      offenders.push(`${match[0]} at offset ${match.index ?? 0}`);
    }
    expect(offenders).toEqual([]);
  });

  it("neutralises whatever is left when the reader asks for less motion", () => {
    const reduce = blockBody(REDUCE);
    expect(reduce).toContain("animation-duration");
    expect(reduce).toContain("transition-duration");
    expect(reduce).toContain("scroll-behavior: auto");
  });
});
