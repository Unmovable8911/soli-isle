import { createHash, randomUUID } from "node:crypto";
import { stat } from "node:fs/promises";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import type { DatabaseConnection } from "@/db/database";
import { asset, assetReference, assetVariant } from "@/db/schema";
import {
  buildAssetAddress,
  extractAssetIds,
  isSafeAssetId,
  type AssetFormat,
  type AssetVariant,
} from "@/domain/asset-address";
import type { Clock } from "@/domain/clock";
import { AssetFileStore } from "@/storage/asset-file-store";
import {
  AssetUploadError,
  DISPLAY_VARIANT_WIDTH,
  MAX_ASSET_UPLOAD_BYTES,
  THUMB_VARIANT_WIDTH,
  inspectAssetImage,
  mimeTypeForAssetFormat,
  renderAssetVariant,
} from "./asset-image";

export {
  AssetUploadError,
  MAX_ASSET_UPLOAD_BYTES,
  type AssetUploadErrorCode,
} from "./asset-image";

export type { AssetVariant } from "@/domain/asset-address";

export interface AssetVariantInfo {
  variant: AssetVariant;
  address: string;
  byteSize: number;
  width: number;
  height: number;
  format: string;
}

export interface AssetReferenceInfo {
  contentKind: string;
  contentId: string;
}

export interface AssetSummary {
  id: string;
  fileName: string;
  mimeType: string;
  byteSize: number;
  width: number;
  height: number;
  contentHash: string;
  uploadedAt: string;
  variants: AssetVariantInfo[];
  references: AssetReferenceInfo[];
  isOrphan: boolean;
}

export interface AssetContext {
  database: DatabaseConnection;
  clock: Clock;
  files: AssetFileStore;
  /** Test seam only; production uses MAX_ASSET_UPLOAD_BYTES. */
  maxUploadBytes?: number;
}

export function createAssetContext(
  database: DatabaseConnection,
  clock: Clock,
  resourceDir: string,
): AssetContext {
  return {
    database,
    clock,
    files: new AssetFileStore(resourceDir),
  };
}

const VARIANT_ORDER: readonly AssetVariant[] = ["original", "display", "thumb"];

type AssetRow = typeof asset.$inferSelect;
type AssetVariantRow = typeof assetVariant.$inferSelect;
type AssetReferenceRow = typeof assetReference.$inferSelect;

function compareVariants(left: AssetVariantRow, right: AssetVariantRow): number {
  return VARIANT_ORDER.indexOf(left.variant) - VARIANT_ORDER.indexOf(right.variant);
}

function compareReferences(left: AssetReferenceRow, right: AssetReferenceRow): number {
  return (
    left.contentKind.localeCompare(right.contentKind) ||
    left.contentId.localeCompare(right.contentId)
  );
}

function toVariantInfo(row: AssetVariantRow): AssetVariantInfo {
  return {
    variant: row.variant,
    address: buildAssetAddress({
      assetId: row.assetId,
      variant: row.variant,
      format: row.format,
    }),
    byteSize: row.byteSize,
    width: row.width,
    height: row.height,
    format: row.format,
  };
}

function toAssetSummary(
  record: AssetRow,
  variants: AssetVariantRow[],
  references: AssetReferenceRow[],
): AssetSummary {
  const orderedReferences = references
    .slice()
    .sort(compareReferences)
    .map((row) => ({ contentKind: row.contentKind, contentId: row.contentId }));

  return {
    id: record.id,
    fileName: record.fileName,
    mimeType: record.mimeType,
    byteSize: record.byteSize,
    width: record.width,
    height: record.height,
    contentHash: record.contentHash,
    uploadedAt: record.uploadedAt,
    variants: variants.slice().sort(compareVariants).map(toVariantInfo),
    references: orderedReferences,
    isOrphan: orderedReferences.length === 0,
  };
}

export async function uploadAsset(
  ctx: AssetContext,
  input: { fileName: string; bytes: Uint8Array },
): Promise<AssetSummary> {
  const limit = ctx.maxUploadBytes ?? MAX_ASSET_UPLOAD_BYTES;
  if (input.bytes.byteLength === 0) {
    throw new AssetUploadError("invalid-image", "The uploaded file is empty");
  }
  if (input.bytes.byteLength > limit) {
    throw new AssetUploadError("too-large", "The uploaded file exceeds the size limit");
  }

  const inspected = await inspectAssetImage(input.bytes);
  const display = await renderAssetVariant(input.bytes, DISPLAY_VARIANT_WIDTH);
  const thumb = await renderAssetVariant(input.bytes, THUMB_VARIANT_WIDTH);

  const assetId = randomUUID();
  const uploadedAt = ctx.clock.now().toISOString();
  const contentHash = createHash("sha256").update(input.bytes).digest("hex");
  const mimeType = mimeTypeForAssetFormat(inspected.format);

  const variantRows: AssetVariantRow[] = [
    {
      assetId,
      variant: "original",
      byteSize: input.bytes.byteLength,
      width: inspected.width,
      height: inspected.height,
      format: inspected.format,
    },
    {
      assetId,
      variant: "display",
      byteSize: display.byteSize,
      width: display.width,
      height: display.height,
      format: display.format,
    },
    {
      assetId,
      variant: "thumb",
      byteSize: thumb.byteSize,
      width: thumb.width,
      height: thumb.height,
      format: thumb.format,
    },
  ];

  try {
    await ctx.files.writeVariantFile(assetId, "original", inspected.format, input.bytes);
    await ctx.files.writeVariantFile(assetId, "display", "webp", display.bytes);
    await ctx.files.writeVariantFile(assetId, "thumb", "webp", thumb.bytes);
  } catch (error) {
    await ctx.files.removeAsset(assetId);
    throw error;
  }

  try {
    ctx.database.db.transaction((tx) => {
      tx.insert(asset)
        .values({
          id: assetId,
          fileName: input.fileName,
          mimeType,
          byteSize: input.bytes.byteLength,
          width: inspected.width,
          height: inspected.height,
          contentHash,
          uploadedAt,
        })
        .run();
      tx.insert(assetVariant).values(variantRows).run();
    });
  } catch (error) {
    await ctx.files.removeAsset(assetId);
    throw error;
  }

  return toAssetSummary(
    {
      id: assetId,
      fileName: input.fileName,
      mimeType,
      byteSize: input.bytes.byteLength,
      width: inspected.width,
      height: inspected.height,
      contentHash,
      uploadedAt,
    },
    variantRows,
    [],
  );
}

export async function listAssets(ctx: AssetContext): Promise<AssetSummary[]> {
  const db = ctx.database.db;
  const records = db
    .select()
    .from(asset)
    .orderBy(desc(asset.uploadedAt), asc(asset.id))
    .all();
  const variants = db.select().from(assetVariant).all();
  const references = db.select().from(assetReference).all();

  const variantsByAsset = new Map<string, AssetVariantRow[]>();
  for (const row of variants) {
    const group = variantsByAsset.get(row.assetId);
    if (group === undefined) {
      variantsByAsset.set(row.assetId, [row]);
    } else {
      group.push(row);
    }
  }

  const referencesByAsset = new Map<string, AssetReferenceRow[]>();
  for (const row of references) {
    const group = referencesByAsset.get(row.assetId);
    if (group === undefined) {
      referencesByAsset.set(row.assetId, [row]);
    } else {
      group.push(row);
    }
  }

  return records.map((record) =>
    toAssetSummary(
      record,
      variantsByAsset.get(record.id) ?? [],
      referencesByAsset.get(record.id) ?? [],
    ),
  );
}

export async function listOrphanAssets(ctx: AssetContext): Promise<AssetSummary[]> {
  const assets = await listAssets(ctx);
  return assets.filter((summary) => summary.isOrphan);
}

export async function getAssetVariantFile(
  ctx: AssetContext,
  assetId: string,
  variant: AssetVariant,
  format?: AssetFormat,
): Promise<{ path: string; mimeType: string; byteSize: number } | null> {
  if (!isSafeAssetId(assetId)) {
    return null;
  }

  const row = ctx.database.db
    .select()
    .from(assetVariant)
    .where(and(eq(assetVariant.assetId, assetId), eq(assetVariant.variant, variant)))
    .get();
  if (row === undefined) {
    return null;
  }
  if (format !== undefined && row.format !== format) {
    return null;
  }

  const filePath = ctx.files.variantPath(assetId, variant, row.format);
  try {
    const fileStats = await stat(filePath);
    if (!fileStats.isFile()) {
      return null;
    }
    return {
      path: filePath,
      mimeType: mimeTypeForAssetFormat(row.format),
      byteSize: fileStats.size,
    };
  } catch {
    return null;
  }
}

export async function deleteAsset(
  ctx: AssetContext,
  assetId: string,
): Promise<{ deleted: true } | { deleted: false; reason: "not-found" | "referenced" }> {
  if (!isSafeAssetId(assetId)) {
    return { deleted: false, reason: "not-found" };
  }

  const db = ctx.database.db;
  const record = db.select().from(asset).where(eq(asset.id, assetId)).get();
  if (record === undefined) {
    return { deleted: false, reason: "not-found" };
  }

  const reference = db
    .select({ id: assetReference.id })
    .from(assetReference)
    .where(eq(assetReference.assetId, assetId))
    .limit(1)
    .get();
  if (reference !== undefined) {
    return { deleted: false, reason: "referenced" };
  }

  db.delete(asset).where(eq(asset.id, assetId)).run();

  // The record is already gone: a leftover file is harmless (orphan bytes),
  // while a record whose files vanished would render as a broken image.
  try {
    await ctx.files.removeAsset(assetId);
  } catch {
    // best effort
  }

  return { deleted: true };
}

export async function syncAssetReferences(
  ctx: AssetContext,
  input: { contentKind: string; contentId: string; body: string },
): Promise<void> {
  const db = ctx.database.db;
  const candidateIds = extractAssetIds(input.body);
  const knownIds =
    candidateIds.length === 0
      ? []
      : db
          .select({ id: asset.id })
          .from(asset)
          .where(inArray(asset.id, candidateIds))
          .all()
          .map((row) => row.id);

  db.transaction((tx) => {
    tx.delete(assetReference)
      .where(
        and(
          eq(assetReference.contentKind, input.contentKind),
          eq(assetReference.contentId, input.contentId),
        ),
      )
      .run();

    if (knownIds.length > 0) {
      tx.insert(assetReference)
        .values(
          knownIds.map((assetId) => ({
            assetId,
            contentKind: input.contentKind,
            contentId: input.contentId,
          })),
        )
        .run();
    }
  });
}
