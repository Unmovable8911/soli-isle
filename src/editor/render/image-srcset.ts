import { buildAssetAddress, parseAssetAddress } from "@/domain/asset-address";

const VARIANT_WIDTHS = [
  { variant: "display", width: 1600 },
  { variant: "thumb", width: 800 },
] as const;

/**
 * Article body images keep the literal `/media/<id>/<variant>.<ext>` address in
 * their `src` (that is what `extractAssetIds` scans for reference tracking), so
 * the responsive candidates are derived here at render time instead of being
 * stored in the JSON.
 */
export function imageSrcset(src: string): string | null {
  const parsed = parseAssetAddress(src);
  if (parsed === null) {
    return null;
  }

  return VARIANT_WIDTHS.map(
    ({ variant, width }) =>
      `${buildAssetAddress({ assetId: parsed.assetId, variant, format: "webp" })} ${width}w`,
  ).join(", ");
}
