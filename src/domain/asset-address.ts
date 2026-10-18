export const ASSET_VARIANTS = ["original", "display", "thumb"] as const;
export type AssetVariant = (typeof ASSET_VARIANTS)[number];

export const ASSET_FORMATS = ["jpeg", "png", "webp", "avif", "gif"] as const;
export type AssetFormat = (typeof ASSET_FORMATS)[number];

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ADDRESS_PATTERN = /^\/media\/([^/]+)\/(original|display|thumb)\.([a-z0-9]+)$/;
const ADDRESS_CANDIDATE_PATTERN =
  /(?<![\w.:/-])\/media\/[0-9A-Za-z-]+\/(?:original|display|thumb)\.[a-z0-9]+/g;

const EXTENSION_BY_FORMAT: Record<AssetFormat, string> = {
  jpeg: "jpg",
  png: "png",
  webp: "webp",
  avif: "avif",
  gif: "gif",
};

const FORMAT_BY_EXTENSION: Record<string, AssetFormat> = {
  jpg: "jpeg",
  png: "png",
  webp: "webp",
  avif: "avif",
  gif: "gif",
};

export function isAssetVariant(value: string): value is AssetVariant {
  return (ASSET_VARIANTS as readonly string[]).includes(value);
}

export function isAssetFormat(value: string): value is AssetFormat {
  return (ASSET_FORMATS as readonly string[]).includes(value);
}

export function assetFileExtension(format: AssetFormat): string {
  return EXTENSION_BY_FORMAT[format];
}

export function isSafeAssetId(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export interface AssetAddressInput {
  assetId: string;
  variant: AssetVariant;
  format: AssetFormat;
}

export function buildAssetAddress(input: AssetAddressInput): string {
  if (!isSafeAssetId(input.assetId)) {
    throw new Error("Asset id must be a UUID");
  }
  if (!isAssetFormat(input.format)) {
    throw new Error(`Unsupported asset format: ${String(input.format)}`);
  }
  if (input.variant !== "original" && input.format !== "webp") {
    throw new Error("Generated asset variants are always WebP");
  }

  return `/media/${input.assetId}/${input.variant}.${assetFileExtension(input.format)}`;
}

export interface ParsedAssetAddress {
  assetId: string;
  variant: AssetVariant;
  format: AssetFormat;
  address: string;
}

export function parseAssetAddress(address: string): ParsedAssetAddress | null {
  const match = ADDRESS_PATTERN.exec(address);
  if (!match) {
    return null;
  }

  const [, assetId = "", variant = "", extension = ""] = match;
  if (!isSafeAssetId(assetId) || !isAssetVariant(variant)) {
    return null;
  }

  const format = FORMAT_BY_EXTENSION[extension];
  if (format === undefined) {
    return null;
  }
  if (variant !== "original" && format !== "webp") {
    return null;
  }

  return { assetId, variant, format, address };
}

export function extractAssetIds(body: string): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();

  for (const candidate of body.match(ADDRESS_CANDIDATE_PATTERN) ?? []) {
    const parsed = parseAssetAddress(candidate);
    if (parsed === null || seen.has(parsed.assetId)) {
      continue;
    }
    seen.add(parsed.assetId);
    ids.push(parsed.assetId);
  }

  return ids;
}
