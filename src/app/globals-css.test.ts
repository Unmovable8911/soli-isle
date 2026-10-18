import { readdirSync, readFileSync, statSync } from "node:fs";
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

/**
 * The rule as written at the top level, before a media query narrows it. Used
 * where the base rule is the contract and a breakpoint is the exception.
 */
function firstRuleBody(selector: string): string {
  const rule = rules().find((candidate) => candidate.prelude === selector);
  if (rule === undefined) {
    throw new Error(`globals.css has no rule for ${selector}`);
  }
  return rule.body;
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

/**
 * Type is the other half of the visual contract and the one part of it a
 * network request could quietly replace: a CDN face means a third party learns
 * who read what, and an offline reader gets a fallback. Both families are OFL,
 * so both are shipped with their licence next to them.
 */
const FONT_DIR = path.resolve(process.cwd(), "public/fonts");

const FACES = [
  { family: "Lora", file: "lora-latin-wght-normal.woff2", weights: "400 700", licence: "OFL-Lora.txt" },
  { family: "Inter", file: "inter-latin-wght-normal.woff2", weights: "100 900", licence: "OFL-Inter.txt" },
] as const;

function fontFace(family: string): Map<string, string> | undefined {
  return rules()
    .filter((rule) => rule.prelude === "@font-face")
    .map((rule) => declarations(rule.body))
    .find((face) => face.get("font-family") === `"${family}"`);
}

describe("self-hosted type", () => {
  it.each(FACES)("ships $family as a local latin subset", ({ family, file, weights, licence }) => {
    expect(statSync(path.join(FONT_DIR, file)).size, file).toBeGreaterThan(8000);
    expect(readdirSync(FONT_DIR), `${family} licence`).toContain(licence);

    const face = fontFace(family);
    expect(face, `no @font-face for ${family}`).toBeDefined();
    expect(face?.get("src"), family).toContain(`/fonts/${file}`);
    expect(face?.get("font-display"), family).toBe("swap");
    expect(face?.get("font-weight"), family).toBe(weights);
  });

  it("never fetches a face from another origin", () => {
    expect(SOURCE).not.toMatch(/https?:\/\//);
    expect(SOURCE).not.toMatch(/@import\s+url\(/);
  });

  it("puts the Latin serif on headings and the Latin sans on body text", () => {
    // The Chinese faces follow in the same stack, so a han glyph falls through
    // to the system CJK face without a second rule on every element.
    const body = declarations(blockBody("body")).get("font-family") ?? "";
    expect(body.indexOf('"Inter"')).toBe(0);
    expect(body).toContain('"PingFang SC"');
    expect(body).toContain('"Noto Sans CJK SC"');
    expect(body).toContain("sans-serif");

    const heading = declarations(blockBody("h1")).get("font-family") ?? "";
    expect(heading.indexOf('"Lora"')).toBe(0);
    expect(heading).toContain('"Songti SC"');
    expect(heading).toContain('"Noto Serif CJK SC"');
    expect(heading).toContain("serif");
  });

  it("changes only the metrics under :lang(zh)", () => {
    // Serifs and sans are the same faces; what a han glyph needs is air
    // between the lines and a hair of tracking, and what it does not need is
    // the negative tracking a Latin display face is cut for.
    const prose = declarations(blockBody(":lang(zh) .article-body"));
    expect(prose.get("line-height")).toBe("1.9");
    expect(prose.get("letter-spacing")).toBe("0.01em");

    const heading = declarations(blockBody(":lang(zh) h1"));
    expect(heading.get("line-height")).toBe("1.4");
    expect(heading.get("letter-spacing")).toBe("0");
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

/**
 * The line a rule draws, whichever side it names it on. A control boundary is a
 * box, so it uses the shorthand; a separator is a line *between* two things, so
 * it is written as a top rule. What these tables audit is the token behind that
 * edge, and that is the same question either way.
 */
function drawnBorder(body: string): string | undefined {
  const declared = declarations(body);
  return (
    declared.get("border") ??
    declared.get("border-top") ??
    declared.get("border-bottom") ??
    declared.get("border-block") ??
    declared.get("border-inline")
  );
}

/** A shape only a control may draw: text fields, the writing surfaces. */
const CONTROL_BORDERS = [
  ".post-composer-surface",
  ".article-editor-content",
  ".reader-search-form input",
  ".post-composer-inline input",
  ".admin-login-form input",
  ".article-callout-tone select",
  ".article-field input",
  ".article-field select",
  ".article-field textarea",
  ".article-cover-actions button",
  ".asset-button",
  ".asset-pick-button",
  ".article-table button",
  ".article-toolbar button",
  ".article-editor-locales button",
  ".article-inline-create button",
  ".article-publish button",
  ".article-preview-header button",
  ".admin-page-action",
  ".site-search input",
  ".site-menu summary",
  ".site-rail button",
  ".feed-more-button",
  ".empty-state-action a",
  ".empty-state-action button",
] as const;

/**
 * Cards, chips and section rules: the decorative hairline. It is deliberately
 * under 3:1 — that is what a hairline is — so a card that reached for
 * --border-strong would shout every box on the page.
 */
const DECORATIVE_BORDERS = [
  ".article-card",
  ".reader-page-head",
  ".reader-pill",
  ".archive-month-head",
  ".archive-row + .archive-row",
  ".feed-heading",
  ".post-card + .post-card",
  ".post-tag",
  ".article-meta",
  ".asset-card",
  ".article-preview",
  ".article-locales a",
  ".reader-article-nav a",
  ".article-body details",
  ".article-toc",
] as const;

describe("control boundaries", () => {
  it.each(CONTROL_BORDERS)("%s draws its border from the control boundary token", (selector) => {
    const border = drawnBorder(blockBody(selector));
    expect(border, selector).toBeDefined();
    // A diluted mix is how a boundary ends up under 3:1 without anyone noticing.
    expect(border, selector).not.toContain("color-mix");
    // Only --border-strong is measured at 3:1. Accepting --border here would let
    // the 1.22:1 hairline become an input's edge without failing a single test.
    expect(border, selector).toMatch(/var\(--border-strong\)/);
  });

  it.each(DECORATIVE_BORDERS)("%s draws only the decorative hairline", (selector) => {
    const border = drawnBorder(blockBody(selector));
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

/**
 * Token registration: a role that is not in TOKEN_PAIRS is a colour nobody
 * measured, and a var() that is not declared renders as nothing at all. Both
 * are silence, which is the failure mode this test exists to break.
 */
/**
 * The one role that may stay unmeasured: the decorative hairline. It carries no
 * text and frames nothing a Reader has to perceive as an edge, so its 1.2:1 is
 * the point of it rather than a failure — and CONTROL_BORDERS below is what
 * stops it from becoming a control's outline instead.
 */
const UNMEASURED_ROLES = new Set(["--border"]);

describe("token registration", () => {
  it.each(Object.keys(THEMES) as Theme[])("registers a measured pair for every %s role", (theme) => {
    const measured = new Set(TOKEN_PAIRS.flatMap((pair) => [pair.foreground, pair.background]));
    const unregistered = [...themeTokens(theme).keys()].filter(
      (name) => !measured.has(name.slice(2)) && !UNMEASURED_ROLES.has(name),
    );
    expect(unregistered).toEqual([]);
  });

  it("declares exactly the eight roles", () => {
    expect([...themeTokens("light").keys()].sort()).toEqual([...TOKEN_ROLES].sort());
    expect([...themeTokens("dark").keys()].sort()).toEqual([...TOKEN_ROLES].sort());
  });

  it("resolves every var() the layers name", () => {
    const declared = new Set(themeTokens("light").keys());
    const unknown = new Set<string>();
    for (const match of SOURCE.matchAll(/var\((--[a-z-]+)\)/g)) {
      const name = match[1] ?? "";
      if (!declared.has(name)) {
        unknown.add(name);
      }
    }
    expect([...unknown]).toEqual([]);
  });
});

/**
 * The scale bottoms out at 12px for anything a Reader has to read. The one
 * exception the design system allows is a kicker: 10px, uppercase, 0.1em of
 * tracking, never a sentence. Registering a selector here is the price of going
 * under the floor, and the other two properties are checked as well.
 */
const SMALL_TEXT: readonly string[] = [".article-card-kicker", ".article-kicker"];

describe("the type floor", () => {
  it.each(SMALL_TEXT)("%s is a kicker, not a sentence", (selector) => {
    const style = declarations(blockBody(selector));
    expect(style.get("text-transform"), selector).toBe("uppercase");
    expect(style.get("letter-spacing"), selector).toBe("0.1em");
  });

  it("never sets type below 12px without a registered kicker", () => {
    const offenders: string[] = [];
    for (const rule of rules()) {
      if (rule.prelude.startsWith("@")) {
        continue;
      }
      const size = declarations(rule.body).get("font-size");
      const match = /^([\d.]+)(rem|em|px)$/.exec(size ?? "");
      if (match === null) {
        continue;
      }
      const value = Number.parseFloat(match[1] ?? "0");
      const floor = match[2] === "px" ? 12 : 0.75;
      if (value < floor && !SMALL_TEXT.includes(rule.prelude)) {
        offenders.push(`${rule.prelude} { font-size: ${size} }`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

/** Controls a thumb has to hit on a 360–430px phone. */
const READER_CONTROLS = [
  ".site-topbar a",
  ".site-topbar button",
  ".admin-topbar a",
  ".admin-topbar button",
  ".site-rail a",
  ".site-rail button",
  ".site-menu summary",
  ".post-expand",
  ".feed-more-button",
  ".post-tag",
  ".lightbox-close",
  ".lightbox-previous",
  ".lightbox-next",
  ".reader-tags a",
  ".reader-pill",
  ".empty-state-action a",
  ".empty-state-action button",
] as const;

/**
 * Links a listing draws. The browser's own blue underline is the tell of a page
 * nobody styled, so every one of these names its ink and drops the underline;
 * the hover colour is where a Reader learns it is live.
 */
const LIST_ANCHORS = [
  ".breadcrumbs a",
  ".article-card-title a",
  ".article-card-kicker a",
  ".reader-pill a",
  ".archive-row-title",
  ".archive-row-category",
  // Outside the reading column too: the console's and the reader's top bars,
  // the Article's kicker, its Locale pills, its contents and its pager.
  "header nav a",
  ".article-kicker",
  ".article-locales a",
  ".article-toc a",
  ".reader-tags a",
  ".reader-article-nav a",
  ".empty-state-action a",
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

/**
 * The shell is where a Reader lands before any page exists, so its two promises
 * are mechanical: the rail stays put and scrolls on its own, and the Category
 * tree indents by structure. A flat list with a guessed margin would satisfy a
 * screenshot and break the moment a Category is named at another depth.
 */
describe("the public shell", () => {
  it("pins the top bar at 64px", () => {
    const bar = declarations(blockBody(".site-topbar"));
    expect(bar.get("position")).toBe("sticky");
    expect(bar.get("height")).toBe("4rem");
  });

  it("pins the rail under the bar and scrolls it independently", () => {
    const rail = declarations(blockBody(".site-rail"));
    expect(rail.get("position")).toBe("sticky");
    expect(rail.get("top")).toBe("4rem");
    expect(rail.get("overflow-y")).toBe("auto");
    expect(declarations(blockBody(".site-shell")).get("grid-template-columns")).toContain("16rem");
  });

  it("indents each Category level by 12px", () => {
    expect(declarations(blockBody(".site-tree .site-tree")).get("padding-inline-start")).toBe(
      "0.75rem",
    );
  });

  it("wraps a long Category name instead of truncating it", () => {
    const link = declarations(blockBody(".site-tree a"));
    expect(link.get("overflow-wrap")).toBe("anywhere");
    expect(link.get("text-overflow")).toBeUndefined();
    expect(link.get("white-space")).toBeUndefined();
  });
});

/**
 * The Feed is a stream, not a stack of panels. Three things make it one and all
 * three are invisible to a screenshot: one 42rem column, a hairline *between*
 * two Posts rather than a frame around one, and silence on hover — a Post has no
 * page of its own, so nothing about it may move to invite a click.
 */
describe("the Feed is a stream", () => {
  it("sets Posts in one 42rem column", () => {
    const feed = declarations(blockBody(".feed"));
    expect(feed.get("display")).toBe("grid");
    expect(feed.get("max-width")).toBe("42rem");
  });

  it("frames no Post: no card edge, no plate, no shadow", () => {
    const card = declarations(blockBody(".post-card"));
    expect(card.get("border")).toBeUndefined();
    expect(card.get("border-radius")).toBeUndefined();
    expect(card.get("background")).toBeUndefined();
    expect(card.get("box-shadow")).toBeUndefined();
  });

  it("separates two Posts with the hairline", () => {
    expect(declarations(blockBody(".post-card + .post-card")).get("border-top")).toBe(
      "1px solid var(--border)",
    );
  });

  it("moves nothing and lights nothing when a pointer crosses a Post", () => {
    const card = rules().filter((rule) => /\bpost-card\b/.test(rule.prelude));
    const displacement = card.flatMap((rule) => {
      const declared = declarations(rule.body);
      return ["transform", "translate", "scale", "box-shadow"].filter((property) =>
        declared.has(property),
      );
    });
    expect(displacement).toEqual([]);
    expect(card.filter((rule) => rule.prelude.includes(":hover")).map((rule) => rule.prelude)).toEqual(
      [],
    );
  });

  it("writes the time as the kicker, at the 14px reading floor", () => {
    const time = declarations(blockBody(".post-time"));
    expect(time.get("color")).toBe("var(--muted)");
    expect(time.get("text-transform")).toBe("uppercase");
    // The floor keeps 14px (a Post's timestamp is read, not glanced at); the
    // tracking is the kicker's, so the form still says "micro-label".
    expect(time.get("letter-spacing")).toBe("0.1em");
  });

  it("grows its H1 on the one 64rem step every page head takes", () => {
    expect(phoneValue(".feed-title", "font-size")).toBe("2.25rem");
    expect(inAtRule(WIDE, ".feed-title")).toContain("font-size: 3rem");
    // 48rem is the Feed's own gallery breakpoint; the page scale is not ours to
    // move earlier than the rest of the site.
    expect(() => inAtRule("@media (min-width: 48rem)", ".feed-title")).toThrow();
  });
});

/**
 * The console adds no side rail (ADR-0001: the editor's writing width outranks
 * shell symmetry), and its own layout is not to be re-arranged, so the writing
 * column is arithmetic: the viewport, minus the page padding, minus the meta
 * panel, minus the grid gap. A padding bump is a narrower page for the one
 * person who writes in it, so it is measured instead of eyeballed.
 */
describe("the editor's writing width", () => {
  const VIEWPORT = 1280;
  /** What the writing column measured at 1280px before this refresh. */
  const BASELINE = 896;

  function px(value: string | undefined, what: string): number {
    const match = /^([\d.]+)(rem|px)$/.exec(value ?? "");
    if (match === null) {
      throw new Error(`${what} is not a single length: ${String(value)}`);
    }
    const size = Number.parseFloat(match[1] ?? "0");
    return match[2] === "rem" ? size * 16 : size;
  }

  it("keeps the writing column as wide at 1280px as it was before the refresh", () => {
    const pagePadding = px(declarations(blockBody("main")).get("padding"), "main padding");

    // The base rule, before the narrow-screen query collapses the grid.
    const grid = declarations(firstRuleBody(".article-editor-main"));
    const columns = grid.get("grid-template-columns") ?? "";
    expect(columns.startsWith("minmax(0, 1fr)"), columns).toBe(true);

    const panel = px(columns.split(/\s+/).at(-1), "the meta panel track");
    // The panel keeps its 20rem: making room by widening it is the same loss.
    expect(panel).toBe(320);

    const writing = VIEWPORT - pagePadding * 2 - panel - px(grid.get("gap"), "the editor gap");
    expect(writing).toBeGreaterThanOrEqual(BASELINE);
  });

  it("gives the writing column the space and the panel a fixed one", () => {
    const columns = declarations(firstRuleBody(".article-editor-main")).get("grid-template-columns");
    expect(columns).toBe("minmax(0, 1fr) 20rem");
  });
});

/**
 * A gallery is the only thing in the Feed that scrolls sideways and the only
 * thing in a Post that is cropped. Both are geometry, so both are pinned here
 * rather than trusted to a screenshot.
 */
describe("a Post's gallery", () => {
  it("keeps a cell at 85% of the track, portrait on a phone and landscape on a desk", () => {
    const cell = blockBody(".post-gallery-cell");
    expect(cell).toContain("flex: 0 0 85%");
    expect(cell).toContain("aspect-ratio: 4 / 5");
    expect(cell).toContain("aspect-ratio: 16 / 9");
  });

  it("rounds the crop to 12px", () => {
    expect(declarations(blockBody(".post-gallery-cell")).get("border-radius")).toBe("0.75rem");
  });

  /**
   * Forty Posts on a 360px phone must scroll inside a gallery and nowhere else.
   * The evidence is the box, not a browser: the track is its own scroll
   * container and its own width, and the grid children that hold it are allowed
   * to be narrower than their content.
   */
  it("scrolls inside its own box instead of widening the page", () => {
    const track = declarations(blockBody(".post-gallery-track"));
    expect(track.get("overflow-x")).toBe("auto");
    expect(track.get("max-width")).toBe("100%");
    for (const holder of [".post-card", ".post-gallery"]) {
      expect(declarations(blockBody(holder)).get("min-width"), holder).toBe("0");
    }
  });
});

describe("the end of the stream", () => {
  it("closes on a centred ghost pill", () => {
    expect(declarations(blockBody(".feed-more")).get("justify-items")).toBe("center");
    const pill = declarations(blockBody(".feed-more-button"));
    expect(pill.get("border-radius")).toBe("999px");
    expect(pill.get("background")).toBe("transparent");
    expect(pill.get("padding")).toBe("0.5rem 1.5rem");
  });
});

describe("the Feed's page head", () => {
  it("holds the Tag filter as a kicker, at the 12px scale", () => {
    const filter = declarations(blockBody(".feed-filter"));
    expect(filter.get("font-size")).toBe("0.75rem");
    expect(filter.get("color")).toBe("var(--muted)");
    expect(filter.get("text-transform")).toBe("uppercase");
  });

  it("ends the head with the hairline the stream grows out of", () => {
    expect(drawnBorder(blockBody(".feed-heading"))).toBe("1px solid var(--border)");
    // The bare header rule carries the console's side padding; the head undoes
    // it so the title sits on the same 42rem edge as the Posts below it.
    expect(declarations(blockBody(".feed-heading")).get("padding")).toBe("0 0 1.25rem");
  });
});

/**
 * The console bar: a horizontal workbench bar, not a second public shell. It is
 * sticky so the six entries stay reachable from the bottom of a long Article
 * list, and 56px so it carries navigation and nothing else.
 */
describe("the console top bar", () => {
  it("pins the bar at 56px", () => {
    // The base rule: narrow screens are the one exception, below 64rem.
    const bar = declarations(firstRuleBody(".admin-topbar"));
    expect(bar.get("position")).toBe("sticky");
    expect(bar.get("top")).toBe("0");
    expect(bar.get("height")).toBe("3.5rem");
  });

  it("keeps the six entries on one horizontal line", () => {
    const list = declarations(blockBody(".admin-nav ul"));
    expect(list.get("display")).toBe("flex");
    expect(list.get("flex-direction")).toBe("row");
  });

  it("marks the current entry, and leaves the wordmark and the badge marking nothing", () => {
    expect(declarations(blockBody(".admin-nav a[aria-current=\"page\"]")).get("font-weight")).toBe(
      "600",
    );
  });
});

describe("the console page head", () => {
  it("puts the action at the far end of the head and keeps it off the H1's line on a phone", () => {
    const head = declarations(blockBody(".admin-page-head"));
    expect(head.get("display")).toBe("flex");
    expect(head.get("justify-content")).toBe("space-between");
    expect(head.get("flex-wrap")).toBe("wrap");
  });
});

describe("the console tables", () => {
  it("sets the header row as a 12px uppercase micro-label", () => {
    const header = declarations(blockBody(".article-table th"));
    expect(header.get("font-size")).toBe("0.75rem");
    expect(header.get("text-transform")).toBe("uppercase");
    expect(header.get("letter-spacing")).toBe("0.1em");
  });

  it("separates rows with the decorative hairline", () => {
    const cell = declarations(blockBody(".article-table td")).get("border-bottom") ?? "";
    expect(cell).toContain("var(--border)");
    expect(cell).not.toContain("border-strong");
  });

  it("marks a Publication State with its own ink and a dot, in no new colour", () => {
    const dot = declarations(blockBody(".publication-state::before"));
    expect(dot.get("content")).toBe('""');
    expect(dot.get("background")).toBe("currentColor");
    expect(dot.get("border-radius")).toBe("50%");
  });
});

describe("the sign-in page", () => {
  it("centres one 24rem card on the page", () => {
    const page = declarations(blockBody(".admin-login"));
    expect(page.get("display")).toBe("grid");
    expect(page.get("place-items")).toBe("center");

    const card = declarations(blockBody(".admin-login-card"));
    expect(card.get("width")).toBe("100%");
    expect(card.get("max-width")).toBe("24rem");
  });
});

/** The stack of at-rule preludes enclosing a position in the stylesheet. */
/**
 * The Article page's two distances: the column the page is set in, and the
 * measure the sentences are set to. A cover earns the whole column; prose does
 * not, and the contents sit on the measure so a link and its paragraph align.
 */
describe("the Article page", () => {
  it("sets the page in a 896px column and the prose to a 65ch measure", () => {
    expect(declarations(blockBody(".reader-article")).get("max-width")).toBe("56rem");
    expect(declarations(blockBody(".article-body")).get("max-width")).toBe("65ch");
  });

  it("sets body text at 18px on a 1.78 line", () => {
    const prose = declarations(blockBody(".article-body"));
    expect(prose.get("font-size")).toBe("1.125rem");
    expect(prose.get("line-height")).toBe("1.78");
  });

  it("shows the cover whole, inside the viewport and never cropped", () => {
    const cover = declarations(blockBody(".reader-article-cover img"));
    expect(cover.get("max-height")).toBe("80vh");
    // A crop would win the ratio back by throwing the picture away.
    expect(cover.get("object-fit")).toBeUndefined();
    expect(declarations(blockBody(".reader-article-cover")).get("margin")).toContain("auto");
  });

  it("still caps a very tall body image by viewport height, uncropped", () => {
    const tall = declarations(blockBody(".article-body .article-image--tall"));
    expect(tall.get("max-height")).toMatch(/vh$/);
    expect(tall.get("object-fit")).toBeUndefined();
  });

  it("sets the kicker as a micro-label rather than a sentence", () => {
    const kicker = declarations(blockBody(".article-kicker"));
    expect(kicker.get("font-size")).toBe("0.625rem");
    expect(kicker.get("text-transform")).toBe("uppercase");
    expect(kicker.get("letter-spacing")).toBe("0.1em");
  });

  it("stops an anchor below the sticky bar instead of under it", () => {
    // The bar is 4rem (asserted above); an anchor that ignores it lands the
    // heading underneath, which reads as a broken link.
    const heading = declarations(blockBody(".article-body h2"));
    expect(Number.parseFloat(heading.get("scroll-margin-top") ?? "0")).toBeGreaterThanOrEqual(4);
  });

  it("indents the contents two levels, on the same measure as the prose", () => {
    expect(declarations(blockBody(".article-toc")).get("max-width")).toBe("65ch");
    expect(declarations(blockBody(".article-toc-sublist")).get("padding-left")).toBe("1rem");
  });
});

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

/**
 * A selector's declarations as one breakpoint declares them. blockBody() joins
 * every context a selector appears in, which is right for "does this rule
 * exist" and wrong for "what happens at 64rem", so a rule that only applies
 * inside an at-rule is read from the block that holds it. Every block carrying
 * the prelude is searched, because a later layer may open the same query again.
 */
function inAtRule(prelude: string, selector: string): string {
  const bodies: string[] = [];
  for (const block of rules()) {
    if (block.prelude !== prelude) {
      continue;
    }
    for (const rule of rulesIn(block.body)) {
      const inList =
        !rule.prelude.startsWith("@") &&
        rule.prelude.split(",").map((part) => part.trim()).includes(selector);
      if (rule.prelude === selector || inList) {
        bodies.push(rule.body);
      }
    }
  }
  if (bodies.length === 0) {
    throw new Error(prelude + " has no rule for " + selector);
  }
  return bodies.join("\n");
}

/**
 * The first value a property takes: the layers are mobile-first, so a
 * selector's base rule is declared before the queries that widen it.
 */
function phoneValue(selector: string, property: string): string | undefined {
  const bodies = blockBody(selector);
  const start = bodies.indexOf(property + ":");
  if (start === -1) {
    return undefined;
  }
  const rest = bodies.slice(start + property.length + 1);
  const end = rest.indexOf(";");
  return end === -1 ? undefined : rest.slice(0, end).trim();
}

const WIDE = "@media (min-width: 64rem)";
const WIDER = "@media (min-width: 80rem)";

/**
 * The front page is the first thing every Reader sees, and its three moves are
 * geometric rather than decorative: the masthead grows, the lead only splits
 * where there is room for a 5/7 pair, and the grid is one, two, three columns.
 * The card is also where "no cover" has to be a designed state, not a gap.
 */
describe("the front page", () => {
  it("sets the masthead at 40, 48 and 56px, tracked like a wordmark", () => {
    expect(phoneValue(".home-masthead h1", "font-size")).toBe("2.5rem");
    expect(inAtRule(WIDE, ".home-masthead h1")).toContain("font-size: 3rem");
    expect(inAtRule(WIDER, ".home-masthead h1")).toContain("font-size: 3.5rem");
    expect(declarations(blockBody(".home-masthead h1")).get("letter-spacing")).toBe("-0.02em");
  });

  it("stacks the lead until 64rem, then splits five parts text to seven of cover", () => {
    expect(declarations(blockBody(".article-lead")).get("grid-template-columns")).toBeUndefined();

    const split = inAtRule(WIDE, ".article-lead--split");
    expect(split).toContain("5fr");
    expect(split).toContain("7fr");
    expect(inAtRule(WIDE, ".article-lead--split .article-card-cover")).toContain("grid-column: 2");
  });

  it("lays the grid out as one column, two at 64rem and three at 80rem", () => {
    expect(phoneValue(".article-grid", "grid-template-columns")).toBe("minmax(0, 1fr)");
    expect(inAtRule(WIDE, ".article-grid")).toContain("repeat(2, minmax(0, 1fr))");
    expect(inAtRule(WIDER, ".article-grid")).toContain("repeat(3, minmax(0, 1fr))");
  });

  it("crops every cover to the same 16:10 frame with an 8px radius", () => {
    const cover = declarations(blockBody(".article-card-cover"));
    expect(cover.get("aspect-ratio")).toBe("16 / 10");
    expect(cover.get("border-radius")).toBe("0.5rem");
    expect(cover.get("overflow")).toBe("hidden");
    expect(declarations(blockBody(".article-card-cover img")).get("object-fit")).toBe("cover");
  });

  it("lets a card be as tall as its content, so no cover reserves no image", () => {
    const card = declarations(blockBody(".article-card"));
    expect(card.get("height")).toBeUndefined();
    expect(card.get("min-height")).toBeUndefined();
    // The meta line falls to the bottom of the row, which is what lines a
    // covered card up with a bare one beside it.
    expect(declarations(blockBody(".article-card-meta")).get("margin-top")).toBe("auto");
  });

  it("clamps the excerpt at three lines", () => {
    expect(declarations(blockBody(".article-card-summary")).get("-webkit-line-clamp")).toBe("3");
  });

  it("rests on the hairline alone, keeping the lift and its shadow for hover", () => {
    const card = declarations(blockBody(".article-card"));
    expect(card.get("border")).toBe("1px solid var(--border)");
    expect(card.get("box-shadow")).toBeUndefined();
    expect(
      declarations(inAtRule(NO_PREFERENCE, ".article-card:hover")).get("box-shadow"),
    ).toBeDefined();
  });

  it("lifts a hovered card 4px, but only when motion is welcome", () => {
    const hover = declarations(inAtRule(NO_PREFERENCE, ".article-card:hover"));
    expect(hover.get("transform")).toBe("translateY(-4px)");
    expect(hover.get("box-shadow")).toBeDefined();
  });

  it("cannot push the page sideways on a phone", () => {
    // A grid item is min-width: auto by default, so one long word can widen a
    // column past the viewport; the card opts out and lets its title wrap.
    expect(declarations(blockBody(".article-grid > li")).get("min-width")).toBe("0");
    expect(declarations(blockBody(".article-card")).get("min-width")).toBe("0");
    expect(declarations(blockBody(".article-card-title")).get("overflow-wrap")).toBe("anywhere");
    expect(declarations(blockBody(".article-card-cover img")).get("width")).toBe("100%");
  });
});

/**
 * The browse surfaces — a Category, a Tag, the search results — are the front
 * page's grid under a different head, and the Archive is their opposite: an
 * index whose density is the feature. Both are geometry, so both are pinned
 * here rather than left to a screenshot.
 */
describe("the browse surfaces", () => {
  it("sets the page head at 36, then 48px", () => {
    expect(phoneValue(".reader-page-head h1", "font-size")).toBe("2.25rem");
    expect(inAtRule(WIDE, ".reader-page-head h1")).toContain("font-size: 3rem");
  });

  it("counts under the title as a micro-label rather than a sentence", () => {
    const count = declarations(blockBody(".reader-page-count"));
    expect(count.get("font-size")).toBe("0.75rem");
    expect(count.get("text-transform")).toBe("uppercase");
    expect(count.get("letter-spacing")).toBe("0.1em");
    expect(count.get("color")).toBe("var(--muted)");
  });

  it("ends the head with the hairline the listing grows out of", () => {
    expect(drawnBorder(blockBody(".reader-page-head"))).toBe("1px solid var(--border)");
    // base.css pads a bare header as a top bar; a page head is one column, and
    // the hairline it already draws is the only edge it wants.
    const head = declarations(blockBody(".reader-page-head"));
    expect(head.get("display")).toBe("block");
    expect(head.get("padding")).toBe("0 0 1.5rem");
  });

  it("marks a search hit in the accent, not in the browser's yellow", () => {
    const mark = declarations(blockBody(".article-card mark"));
    expect(mark.get("background")).toContain("var(--accent)");
    expect(mark.get("color")).toBe("var(--fg)");
  });

  it("sets a child Category as a pill, not as a second list", () => {
    expect(declarations(blockBody(".reader-pills")).get("flex-wrap")).toBe("wrap");
    expect(declarations(blockBody(".reader-pill")).get("border-radius")).toBe("999px");
  });

  it("wraps a long name in the head or a pill rather than widening the page", () => {
    // A Category may be named in one unbroken word; a head or pill that cannot
    // break it is a horizontal scrollbar on a 360px phone.
    expect(declarations(blockBody(".reader-page-head h1")).get("overflow-wrap")).toBe("anywhere");
    expect(declarations(blockBody(".reader-pill")).get("max-width")).toBe("100%");
    expect(declarations(blockBody(".reader-pill a")).get("overflow-wrap")).toBe("anywhere");
  });
});

describe("the Archive index", () => {
  it("labels a month at the 12px micro-label, its count across from it", () => {
    const head = declarations(blockBody(".archive-month-head"));
    expect(head.get("font-size")).toBe("0.75rem");
    expect(head.get("text-transform")).toBe("uppercase");
    expect(head.get("letter-spacing")).toBe("0.1em");
    expect(head.get("color")).toBe("var(--muted)");
    expect(head.get("display")).toBe("flex");
    expect(head.get("justify-content")).toBe("space-between");
  });

  it("frames no row: one hairline between two rows and nothing else", () => {
    const row = declarations(blockBody(".archive-row"));
    expect(row.get("border")).toBeUndefined();
    expect(row.get("border-radius")).toBeUndefined();
    expect(row.get("background")).toBeUndefined();
    expect(row.get("box-shadow")).toBeUndefined();
    expect(declarations(blockBody(".archive-row + .archive-row")).get("border-top")).toBe(
      "1px solid var(--border)",
    );
  });

  it("aligns the date column on tabular numerals", () => {
    expect(declarations(blockBody(".archive-row-date")).get("font-variant-numeric")).toBe(
      "tabular-nums",
    );
  });

  it("cannot push the page sideways on a phone, and wraps the title instead", () => {
    // The date track is the only fixed one; the title takes the rest of the row
    // and gives way, because a title the Reader cannot read is not an index.
    expect(phoneValue(".archive-row", "grid-template-columns")).toBe(
      "2.5rem minmax(0, 1fr)",
    );
    const title = declarations(blockBody(".archive-row-title"));
    expect(title.get("min-width")).toBe("0");
    expect(title.get("overflow-wrap")).toBe("anywhere");
    expect(title.get("text-overflow")).toBeUndefined();
    expect(title.get("white-space")).toBeUndefined();
  });

  it("draws every link in ink, never in the browser's own blue", () => {
    // A bare anchor rendering in #0000EE with an underline is the single
    // clearest "nobody styled this page" signal there is.
    for (const selector of LIST_ANCHORS) {
      const style = declarations(blockBody(selector));
      // A token, or an inherit from a parent that names one. What it may never
      // be is unset, which is where the browser's own blue lives.
      expect(style.get("color"), selector).toMatch(/^(var\(--|inherit$)/);
      expect(style.get("text-decoration"), selector).toBe("none");
    }
  });

  it("inks the new listing links from the palette", () => {
    expect(declarations(blockBody(".reader-pill a")).get("color")).toBe("var(--fg)");
    expect(declarations(blockBody(".archive-row-title")).get("color")).toBe("var(--fg)");
    expect(declarations(blockBody(".archive-row-category")).get("color")).toBe("var(--muted)");
    expect(declarations(blockBody(".breadcrumbs a")).get("color")).toBe("var(--muted)");
  });

  it("moves nothing when a pointer crosses a row", () => {
    const rows = rules().filter((rule) => /\barchive-row\b/.test(rule.prelude));
    const displacement = rows.flatMap((rule) => {
      const declared = declarations(rule.body);
      return ["transform", "box-shadow", "translate", "scale"].filter((property) =>
        declared.has(property),
      );
    });
    expect(displacement).toEqual([]);
  });
});

/**
 * The masthead is a wordmark, not a link: the site's own name rendered in the
 * browser's blue and underlined is the one place a stylesheet forgets to
 * finish, and it is the first thing a Reader sees.
 */
describe("the wordmark", () => {
  it("sets the rail's wordmark in the site's ink rather than the browser's blue", () => {
    const wordmark = declarations(blockBody(".site-rail-wordmark"));
    expect(wordmark.get("color")).toBe("var(--fg)");
    expect(wordmark.get("text-decoration")).toBe("none");
    expect(wordmark.get("font-family")).toContain('"Lora"');
    expect(wordmark.get("font-weight")).toBe("700");
  });

  it("keeps the top bar's name and the rail's name in the same ink", () => {
    const name = declarations(blockBody(".site-name"));
    expect(name.get("color")).toBe("inherit");
    expect(name.get("text-decoration")).toBe("none");
  });
});

/**
 * base.css styles a bare <header> as a shell's top bar — a flex row — and the
 * Article header reuses the element, so it has to opt back out. The spec's order
 * is kicker, title, dek: stacked, the way the DOM already reads.
 */
describe("the Article header", () => {
  it("stacks the kicker over the title instead of laying them out as a bar", () => {
    expect(declarations(blockBody(".reader-article-header")).get("display")).toBe("block");
  });

  it("keeps the underline where a link sits inside a sentence", () => {
    // Prose and the Feed's Tag filter are text with a link in it, so the
    // underline is the affordance a Reader without colour vision needs.
    expect(declarations(blockBody(".article-body a")).get("text-decoration")).toBe("underline");
    expect(declarations(blockBody(".feed-filter a")).get("text-decoration")).toBe("underline");
  });

  it("gives a stripped link a second affordance", () => {
    // The kicker, the Locale pills and the contents are lists of links, not
    // sentences containing one link, so they drop the UA underline; the pill
    // keeps its border as a shape and the other two underline on interaction.
    expect(declarations(blockBody(".article-toc a:hover")).get("text-decoration")).toBe("underline");
    expect(declarations(blockBody(".article-kicker:hover")).get("text-decoration")).toBe("underline");
    expect(declarations(blockBody(".article-locales a")).get("border")).toContain("var(--border)");
  });
});
/**
 * The page is set on one measure. 65ch is measured in the element's own type,
 * so a header, a contents box or a pager that names 65ch while inheriting 14px
 * lands on a narrower column than the prose and the page reads ragged.
 */
describe("the Article page's measure", () => {
  const MEASURE_BLOCKS = [
    [".reader-article-header", ".reader-article-header"],
    [".article-toc", ".article-toc"],
    [".reader-article > .reader-tags", ".reader-tags"],
    [".reader-article-nav", ".reader-article-nav"],
  ] as const;

  it.each(MEASURE_BLOCKS)("%s sits on the prose measure", (selector, fontSizeOwner) => {
    expect(declarations(blockBody(selector)).get("max-width")).toBe("65ch");
    // The prose declares 1.125rem; a block that measures its ch in smaller type
    // is a narrower column, which is what "aligned" must not mean.
    expect(declarations(blockBody(fontSizeOwner)).get("font-size")).toBe("1.125rem");
  });

  it("turns the shell's bar header back into a page header", () => {
    const header = declarations(blockBody(".reader-article-header"));
    expect(header.get("display")).toBe("block");
    expect(header.get("padding")).toBe("0");
    expect(header.get("border")).toBe("0");
  });

  it("keeps the bars' 44px thumb boxes out of every other <header>", () => {
    // The Article kicker and its Locale pills live in a <header> too. A bare
    // `header a` rule would render them 44px tall with the text at the top.
    expect(() => blockBody("header a")).toThrow(/has no rule/);
    for (const bar of [".site-topbar a", ".admin-topbar a"]) {
      expect(blockBody(bar), bar).toContain("min-height: 2.75rem");
    }
  });
});
/**
 * Dead CSS is invisible to every other assertion here: a rule for a class no
 * component renders still parses, still measures, and never reaches a Reader.
 * A class built by a template literal is not dead, and neither is a class KaTeX
 * puts on its own markup, so both are named rather than guessed at.
 */
const COMPOSED_CLASS_PREFIXES = [
  // dashboard-table.tsx: `publication-state-${article.visibility}`
  "publication-state-",
  // article-list.tsx and post-list.tsx: `article-state-${work.visibility}`
  "article-state-",
  // article-editor.tsx: `article-save-${status}`
  "article-save-",
  // asset-library.tsx: `asset-upload-${record.status}`
  "asset-upload-",
] as const;

const THIRD_PARTY_CLASSES = new Set([
  // KaTeX marks its display blocks itself; the rule lets a wide formula scroll
  // inside the prose instead of widening the page.
  "katex-display",
]);

function componentSource(): string {
  const files: string[] = [];
  const walk = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
        files.push(full);
      }
    }
  };
  walk(path.resolve(process.cwd(), "src"));
  return files.map((file) => readFileSync(file, "utf8")).join("\n");
}

/** Whole-word, hyphens included: `post-empty` must not match `post-empty-x`. */
function rendersClass(source: string, name: string): boolean {
  return new RegExp("(^|[^\\w-])" + name + "(?![\\w-])").test(source);
}

describe("no dead rules", () => {
  const RENDERED = componentSource();

  it("styles no class a component never renders", () => {
    const classes = [...new Set([...SOURCE.matchAll(/\.([a-zA-Z][a-zA-Z0-9_-]*)/g)].map((match) => match[1] ?? ""))];
    const dead = classes.filter(
      (name) =>
        !rendersClass(RENDERED, name) &&
        !COMPOSED_CLASS_PREFIXES.some((prefix) => name.startsWith(prefix)) &&
        !THIRD_PARTY_CLASSES.has(name),
    );

    expect(dead).toEqual([]);
  });

  it("declares no token nothing reads", () => {
    const read = new Set([...SOURCE.matchAll(/var\((--[a-z-]+)\)/g)].map((match) => match[1] ?? ""));
    const unused = [...themeTokens("light").keys()].filter((name) => !read.has(name));

    expect(unused).toEqual([]);
  });
});
/**
 * A console page at 200% zoom is a 180px-wide page. A six-column table and a
 * grid that sizes its track to the table's min-content both widen the document
 * instead of scrolling, so the table is wrapped and the tracks are allowed to
 * be narrower than their content.
 */
describe("the console at 200% zoom", () => {
  it("scrolls a wide table inside its own box", () => {
    const scroll = declarations(blockBody(".table-scroll"));
    expect(scroll.get("overflow-x")).toBe("auto");
    expect(scroll.get("max-width")).toBe("100%");
  });

  it("lets every single-column grid be narrower than its content", () => {
    for (const selector of [".article-list", ".dashboard", ".tag-manager", ".category-manager", ".asset-library"]) {
      expect(declarations(blockBody(selector)).get("grid-template-columns"), selector).toBe(
        "minmax(0, 1fr)",
      );
    }
  });
});
