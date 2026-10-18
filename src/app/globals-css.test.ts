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

/** A shape only a control may draw: text fields, the writing surfaces. */
const CONTROL_BORDERS = [
  ".post-composer-surface",
  ".article-editor-content",
  ".reader-search-form input",
  ".post-composer-inline input",
  ".admin-login-form input",
  ".article-callout-tone select",
  ".site-search input",
  ".site-menu summary",
  ".site-rail button",
] as const;

/**
 * Cards, chips and section rules: the decorative hairline. It is deliberately
 * under 3:1 — that is what a hairline is — so a card that reached for
 * --border-strong would shout every box on the page.
 */
const DECORATIVE_BORDERS = [
  ".post-card",
  ".article-card",
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
  "header a",
  "header button",
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

