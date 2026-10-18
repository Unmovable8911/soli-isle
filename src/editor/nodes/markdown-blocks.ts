/**
 * The index a `marked` block tokenizer should report as its `start`: marked
 * truncates the surrounding paragraph at that index, so it has to point at a
 * line start. An unanchored `indexOf` match would split prose that merely
 * mentions the marker and leave a stray newline in the text.
 */
export function lineStart(src: string, pattern: RegExp): number {
  const found = pattern.exec(src);
  return found === null ? -1 : found.index;
}
