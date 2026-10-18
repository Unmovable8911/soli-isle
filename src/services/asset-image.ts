import sharp from "sharp";
import { isAssetFormat, type AssetFormat } from "@/domain/asset-address";

export const MAX_ASSET_UPLOAD_BYTES = 25 * 1024 * 1024;
export const DISPLAY_VARIANT_WIDTH = 1600;
export const THUMB_VARIANT_WIDTH = 800;
export const VARIANT_WEBP_QUALITY = 80;

export type AssetUploadErrorCode = "unsupported-type" | "too-large" | "invalid-image";

export class AssetUploadError extends Error {
  readonly code: AssetUploadErrorCode;

  constructor(code: AssetUploadErrorCode, message: string) {
    super(message);
    this.name = "AssetUploadError";
    this.code = code;
  }
}

const MIME_TYPE_BY_FORMAT: Record<AssetFormat, string> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
  gif: "image/gif",
};

export function mimeTypeForAssetFormat(format: AssetFormat): string {
  return MIME_TYPE_BY_FORMAT[format];
}

export interface InspectedAssetImage {
  format: AssetFormat;
  width: number;
  height: number;
}

export interface RenderedAssetVariant {
  bytes: Uint8Array;
  byteSize: number;
  width: number;
  height: number;
  format: "webp";
}

function decodeFailure(): AssetUploadError {
  return new AssetUploadError("invalid-image", "Could not decode the uploaded image");
}

// Animated inputs must be read as a single page: with `{ animated: true }` sharp
// reports the height of the whole stacked filmstrip (pageHeight * pages).
async function readImageMetadata(bytes: Uint8Array) {
  try {
    return await sharp(bytes).metadata();
  } catch {
    throw decodeFailure();
  }
}

export async function inspectAssetImage(bytes: Uint8Array): Promise<InspectedAssetImage> {
  const metadata = await readImageMetadata(bytes);

  const format = metadata.format;
  if (format === undefined) {
    throw decodeFailure();
  }
  if (!isAssetFormat(format)) {
    throw new AssetUploadError("unsupported-type", `Unsupported image format: ${format}`);
  }

  const width = metadata.autoOrient?.width ?? metadata.width;
  const height = metadata.autoOrient?.height ?? metadata.height;
  if (width === undefined || height === undefined || width <= 0 || height <= 0) {
    throw decodeFailure();
  }

  return { format, width, height };
}

// Sharp loads only the first frame of animated inputs unless asked otherwise,
// so the generated variants are always static while the original keeps animation.
export async function renderAssetVariant(
  bytes: Uint8Array,
  width: number,
): Promise<RenderedAssetVariant> {
  try {
    const { data, info } = await sharp(bytes)
      .rotate()
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: VARIANT_WEBP_QUALITY })
      .toBuffer({ resolveWithObject: true });

    return {
      bytes: new Uint8Array(data),
      byteSize: data.byteLength,
      width: info.width,
      height: info.height,
      format: "webp",
    };
  } catch {
    throw decodeFailure();
  }
}
