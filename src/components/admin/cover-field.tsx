/* eslint-disable @next/next/no-img-element -- the preview comes from our own
   /media route handler; next/image would add an optimizer hop for no gain. */

import { buildAssetAddress, isSafeAssetId } from "@/domain/asset-address";
import type { Messages } from "@/messages";

export type CoverLabels = Messages["admin"]["articles"]["meta"];

/**
 * The chosen Cover as an address, or null when there is none. The display
 * derivation is what a card crops to 16:10 and what the editor previews; the
 * long-form header draws the original, from the same Asset.
 *
 * A stored id that is not a UUID cannot be addressed, and `buildAssetAddress`
 * throws on one, so it is reported as "no cover" rather than crashing the panel.
 */
export function coverPreviewAddress(coverAssetId: string | null): string | null {
  if (coverAssetId === null || !isSafeAssetId(coverAssetId)) {
    return null;
  }
  return buildAssetAddress({ assetId: coverAssetId, variant: "display", format: "webp" });
}

export interface CoverFieldProps {
  coverAssetId: string | null;
  labels: CoverLabels;
  onChoose: () => void;
  onRemove: () => void;
}

/**
 * The Cover control in the meta panel. It is the Asset picker that the editor
 * already opens for a body image, pointed at one field instead of the document:
 * "no cover" is a state the Author can return to, not an absence to fix.
 */
export function CoverField({ coverAssetId, labels, onChoose, onRemove }: CoverFieldProps) {
  const address = coverPreviewAddress(coverAssetId);

  return (
    <div className="article-field article-cover" role="group" aria-label={labels.cover}>
      <span>{labels.cover}</span>
      {address === null ? (
        <p className="article-editor-hint">{labels.noCover}</p>
      ) : (
        <img className="article-cover-preview" src={address} alt="" />
      )}
      <div className="article-cover-actions">
        <button type="button" onClick={onChoose}>
          {address === null ? labels.chooseCover : labels.changeCover}
        </button>
        {address === null ? null : (
          <button type="button" onClick={onRemove}>
            {labels.removeCover}
          </button>
        )}
      </div>
    </div>
  );
}
