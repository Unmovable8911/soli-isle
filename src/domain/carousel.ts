/**
 * The index after `delta`, wrapping at both ends of the set. A carousel and a
 * lightbox are the same question — what comes after the last picture is the
 * first one — so they share the arithmetic instead of each trusting its own.
 */
export function wrapIndex(current: number, delta: number, length: number): number {
  if (length <= 0) {
    return 0;
  }
  return (((current + delta) % length) + length) % length;
}
