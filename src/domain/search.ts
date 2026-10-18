/** Search is a LIKE scan over a handful of long Articles, not a query language. */
const MAX_SEARCH_TERMS = 8;

export interface HighlightSegment {
  text: string;
  match: boolean;
}

/**
 * Splits a reader's query into keywords. Case is preserved for display; the
 * comparison itself is case-insensitive. A space-free Chinese phrase stays one
 * term, which is exactly what a phrase search should do.
 */
export function parseSearchTerms(raw: string): string[] {
  const terms: string[] = [];
  const seen = new Set<string>();

  for (const candidate of raw.split(/\s+/)) {
    const term = candidate.trim();
    if (term.length === 0) {
      continue;
    }
    const key = term.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    terms.push(term);
    if (terms.length === MAX_SEARCH_TERMS) {
      break;
    }
  }

  return terms;
}

interface Span {
  start: number;
  end: number;
}

/**
 * Marks each keyword occurrence. Ranges are merged before slicing so two
 * overlapping terms ("ab" and "bc" in "abc") produce one `<mark>`, never
 * interleaved ones.
 */
export function highlightSegments(
  text: string,
  terms: readonly string[],
): HighlightSegment[] {
  if (text.length === 0) {
    return [];
  }

  const haystack = text.toLowerCase();
  const spans: Span[] = [];

  for (const term of terms) {
    const needle = term.toLowerCase();
    if (needle.length === 0) {
      continue;
    }
    let from = 0;
    for (;;) {
      const index = haystack.indexOf(needle, from);
      if (index === -1) {
        break;
      }
      spans.push({ start: index, end: index + needle.length });
      from = index + 1;
    }
  }

  if (spans.length === 0) {
    return [{ text, match: false }];
  }

  spans.sort((left, right) => left.start - right.start || left.end - right.end);
  const merged: Span[] = [];
  for (const span of spans) {
    const last = merged[merged.length - 1];
    if (last !== undefined && span.start <= last.end) {
      last.end = Math.max(last.end, span.end);
      continue;
    }
    merged.push({ ...span });
  }

  const segments: HighlightSegment[] = [];
  let cursor = 0;
  for (const span of merged) {
    if (span.start > cursor) {
      segments.push({ text: text.slice(cursor, span.start), match: false });
    }
    segments.push({ text: text.slice(span.start, span.end), match: true });
    cursor = span.end;
  }
  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), match: false });
  }

  return segments;
}

/**
 * `%` and `_` are LIKE wildcards, so a reader's literal ones must be escaped;
 * the surrounding `%` is the substring wildcard the query form is built on.
 */
export function escapeLikeTerm(term: string): string {
  return term.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
}
