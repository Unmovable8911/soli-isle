import { isRichTextDocument } from "./rich-text";
import { normaliseSlug } from "./slug";

/**
 * The table of contents is derived, never stored: it is what the body already
 * says. Below this many h2 the Reader is not lost yet, and a map of three
 * short sections is furniture, so a short Article shows none at all.
 */
export const TOC_MIN_HEADINGS = 3;

/** A heading that is nothing but punctuation still needs somewhere to be. */
const FALLBACK_ANCHOR = "section";

/** The two levels a table of contents draws; the editor also writes h4. */
export type TocLevel = 2 | 3;

export interface ArticleHeading {
  /** The id the heading renders and the entry links to. */
  id: string;
  level: TocLevel;
  text: string;
}

interface HeadingNode {
  type?: unknown;
  attrs?: { level?: unknown };
  content?: unknown;
  text?: unknown;
}

/**
 * The one anchor allocator. It walks headings in document order, so the
 * renderer and the table of contents agree without either one storing a
 * marker: the same body yields the same ids on every render, and a repeated
 * heading takes its ordinal instead of colliding with the first.
 */
export function createHeadingAnchors(): (text: string) => string {
  const taken = new Set<string>();
  const ordinals = new Map<string, number>();

  return (text: string) => {
    const slug = normaliseSlug(text);
    const base = slug === "" ? FALLBACK_ANCHOR : slug;
    let ordinal = (ordinals.get(base) ?? 0) + 1;
    let candidate = ordinal === 1 ? base : `${base}-${ordinal}`;
    while (taken.has(candidate)) {
      ordinal += 1;
      candidate = `${base}-${ordinal}`;
    }
    ordinals.set(base, ordinal);
    taken.add(candidate);
    return candidate;
  };
}

function parse(bodyJson: string): HeadingNode | null {
  if (!isRichTextDocument(bodyJson)) {
    return null;
  }
  try {
    return JSON.parse(bodyJson) as HeadingNode;
  } catch {
    return null;
  }
}

/** Everything a heading says, marks included, as the text its anchor is cut from. */
function textOf(node: HeadingNode): string {
  if (typeof node.text === "string") {
    return node.text;
  }
  const children = Array.isArray(node.content) ? (node.content as HeadingNode[]) : [];
  return children.map(textOf).join("");
}

/** Document order, depth first: the order the renderer meets headings in. */
function visit(node: HeadingNode, onHeading: (node: HeadingNode) => void): void {
  if (node.type === "heading") {
    onHeading(node);
  }
  const children = Array.isArray(node.content) ? (node.content as HeadingNode[]) : [];
  for (const child of children) {
    visit(child, onHeading);
  }
}

/**
 * Every heading the body carries, with the id it renders — h4 included, so the
 * numbering the anchors share stays the same whether or not a level is listed.
 */
export function articleHeadings(bodyJson: string): ArticleHeading[] {
  const document = parse(bodyJson);
  if (document === null) {
    return [];
  }

  const anchorOf = createHeadingAnchors();
  const found: ArticleHeading[] = [];
  visit(document, (node) => {
    const level = node.attrs?.level;
    const text = textOf(node);
    const id = anchorOf(text);
    if (level === 2 || level === 3) {
      found.push({ id, level, text });
    }
  });
  return found;
}

/** The table of contents for this body, or none when the Article is short. */
export function buildTableOfContents(bodyJson: string): ArticleHeading[] {
  const headings = articleHeadings(bodyJson);
  return headings.filter((heading) => heading.level === 2).length >= TOC_MIN_HEADINGS
    ? headings
    : [];
}
