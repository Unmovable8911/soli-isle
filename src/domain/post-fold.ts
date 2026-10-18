/**
 * The Feed card's fold decision.
 *
 * Nothing is stored: a Post has no "is long" column and never will. The card
 * measures its own rendered body once and asks this function whether that
 * measurement overflowed the collapsed height. Without JavaScript nothing is
 * folded — the body simply reads long — which is the honest degradation of a
 * decision that can only be made in a browser.
 */
export const POST_FOLD_MAX_HEIGHT_PX = 320;

/** Sub-pixel layout rounding must not turn a body into a folded one. */
const TOLERANCE_PX = 1;

export function postBodyShouldFold(
  naturalHeightPx: number,
  maxHeightPx: number = POST_FOLD_MAX_HEIGHT_PX,
): boolean {
  if (!Number.isFinite(naturalHeightPx)) {
    return false;
  }
  return naturalHeightPx > maxHeightPx + TOLERANCE_PX;
}
