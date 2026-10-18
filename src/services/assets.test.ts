import { createHash, randomUUID } from "node:crypto";
import { stat, readFile } from "node:fs/promises";
import sharp from "sharp";
import { afterEach, describe, expect, it } from "vitest";
import type { AssetFileStore } from "@/storage/asset-file-store";
import { createTestHarness, type TestHarness } from "@/test/harness";
import {
  AssetUploadError,
  MAX_ASSET_UPLOAD_BYTES,
  createAssetContext,
  deleteAsset,
  getAssetVariantFile,
  listAssets,
  listOrphanAssets,
  syncAssetReferences,
  uploadAsset,
  type AssetContext,
  type AssetSummary,
} from "./assets";

interface ServiceFixture {
  harness: TestHarness;
  context: AssetContext;
}

const FIXED_UPLOADED_AT = "2025-06-15T08:30:00.000Z";

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

async function solidImage(
  format: "png" | "jpeg" | "webp" | "avif" | "tiff",
  width: number,
  height: number,
): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 30, g: 90, b: 140 } },
  })
    .toFormat(format)
    .toBuffer();
}

async function animatedGif(width: number, height: number, pages: number): Promise<Buffer> {
  const channels = 4;
  const raw = Buffer.alloc(width * height * pages * channels);
  for (let page = 0; page < pages; page++) {
    for (let pixel = 0; pixel < width * height; pixel++) {
      const offset = (page * width * height + pixel) * channels;
      raw[offset] = page * 40;
      raw[offset + 1] = 120;
      raw[offset + 2] = 200;
      raw[offset + 3] = 255;
    }
  }

  return sharp(raw, {
    raw: { width, height: height * pages, channels, pageHeight: height },
  })
    .gif()
    .toBuffer();
}

async function expectUploadError(promise: Promise<unknown>, code: string): Promise<void> {
  await expect(promise).rejects.toBeInstanceOf(AssetUploadError);
  await expect(promise).rejects.toMatchObject({ code });
}

describe("asset service", () => {
  const fixtures: ServiceFixture[] = [];

  async function createFixture(): Promise<ServiceFixture> {
    const harness = await createTestHarness();
    const context = createAssetContext(
      harness.database,
      harness.clock,
      harness.resources.rootDir,
    );
    const fixture = { harness, context };
    fixtures.push(fixture);
    return fixture;
  }

  function findAsset(assets: AssetSummary[], id: string): AssetSummary {
    const asset = assets.find((candidate) => candidate.id === id);
    if (asset === undefined) {
      throw new Error(`Asset ${id} not listed`);
    }
    return asset;
  }

  afterEach(async () => {
    for (const fixture of fixtures.splice(0)) {
      await fixture.harness.close();
    }
  });

  it("uploads an image, records metadata and writes original, display and thumb files", async () => {
    const { context } = await createFixture();
    const bytes = await solidImage("png", 2000, 1200);

    const summary = await uploadAsset(context, { fileName: "hero.png", bytes });

    expect(summary.fileName).toBe("hero.png");
    expect(summary.mimeType).toBe("image/png");
    expect(summary.byteSize).toBe(bytes.byteLength);
    expect(summary.width).toBe(2000);
    expect(summary.height).toBe(1200);
    expect(summary.contentHash).toBe(sha256(bytes));
    expect(summary.uploadedAt).toBe(FIXED_UPLOADED_AT);
    expect(summary.references).toEqual([]);
    expect(summary.isOrphan).toBe(true);
    expect(summary.variants.map((variant) => variant.variant).sort()).toEqual([
      "display",
      "original",
      "thumb",
    ]);

    const byVariant = new Map(summary.variants.map((variant) => [variant.variant, variant]));
    expect(byVariant.get("original")).toMatchObject({
      address: `/media/${summary.id}/original.png`,
      width: 2000,
      height: 1200,
      format: "png",
      byteSize: bytes.byteLength,
    });
    expect(byVariant.get("display")).toMatchObject({
      address: `/media/${summary.id}/display.webp`,
      width: 1600,
      height: 960,
      format: "webp",
    });
    expect(byVariant.get("thumb")).toMatchObject({
      address: `/media/${summary.id}/thumb.webp`,
      width: 800,
      height: 480,
      format: "webp",
    });

    for (const variant of summary.variants) {
      const filePath = context.files.variantPath(summary.id, variant.variant, variant.format as "webp");
      const fileStats = await stat(filePath);
      expect(fileStats.isFile()).toBe(true);
      expect(fileStats.size).toBe(variant.byteSize);
    }

    const displayFile = await getAssetVariantFile(context, summary.id, "display");
    expect(displayFile).not.toBeNull();
    expect(displayFile?.mimeType).toBe("image/webp");
    expect(displayFile?.byteSize).toBe(byVariant.get("display")?.byteSize);
    const displayMetadata = await sharp(displayFile?.path).metadata();
    expect(displayMetadata.format).toBe("webp");
    expect(displayMetadata.width).toBe(1600);
    expect(displayMetadata.height).toBe(960);

    const originalFile = await getAssetVariantFile(context, summary.id, "original");
    expect(originalFile?.mimeType).toBe("image/png");
    const originalBytes = await readFile(originalFile?.path ?? "");
    expect(originalBytes.equals(bytes)).toBe(true);

    await expect(listAssets(context)).resolves.toEqual([summary]);
  });

  it("records the real format and orientation instead of trusting client metadata", async () => {
    const { context } = await createFixture();
    const bytes = await sharp({
      create: { width: 900, height: 600, channels: 3, background: "#336699" },
    })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();

    const summary = await uploadAsset(context, { fileName: "rotated.jpeg", bytes });

    expect(summary.mimeType).toBe("image/jpeg");
    expect(summary.width).toBe(600);
    expect(summary.height).toBe(900);
    const original = summary.variants.find((variant) => variant.variant === "original");
    expect(original?.address).toBe(`/media/${summary.id}/original.jpg`);
  });

  it("never enlarges small images and always stores WebP variants", async () => {
    const { context } = await createFixture();
    const bytes = await solidImage("png", 100, 50);

    const summary = await uploadAsset(context, { fileName: "small.png", bytes });
    const thumb = summary.variants.find((variant) => variant.variant === "thumb");
    const display = summary.variants.find((variant) => variant.variant === "display");

    expect(thumb).toMatchObject({ width: 100, height: 50, format: "webp" });
    expect(display).toMatchObject({ width: 100, height: 50, format: "webp" });
    expect(thumb?.address).toBe(`/media/${summary.id}/thumb.webp`);
    await expect(
      sharp(context.files.variantPath(summary.id, "thumb", "webp")).metadata(),
    ).resolves.toMatchObject({ format: "webp", width: 100, height: 50 });
  });

  it("hashes content stably but gives every upload its own asset id and address", async () => {
    const { context } = await createFixture();
    const bytes = await solidImage("png", 1200, 800);

    const first = await uploadAsset(context, { fileName: "photo.png", bytes });
    const second = await uploadAsset(context, { fileName: "photo.png", bytes });

    expect(first.contentHash).toBe(second.contentHash);
    expect(first.id).not.toBe(second.id);
    expect(first.variants[0]?.address).not.toBe(second.variants[0]?.address);
    await expect(listAssets(context)).resolves.toHaveLength(2);
  });

  it("rejects uploads above the byte limit before decoding", async () => {
    const { context } = await createFixture();
    const bytes = await solidImage("png", 200, 200);
    const limited: AssetContext = { ...context, maxUploadBytes: 64 };

    expect(MAX_ASSET_UPLOAD_BYTES).toBe(25 * 1024 * 1024);
    await expectUploadError(uploadAsset(limited, { fileName: "big.png", bytes }), "too-large");

    const oversized = new Uint8Array(MAX_ASSET_UPLOAD_BYTES + 1);
    await expectUploadError(
      uploadAsset(context, { fileName: "huge.png", bytes: oversized }),
      "too-large",
    );
    await expect(listAssets(context)).resolves.toEqual([]);
  });

  it("rejects unsupported and invalid image data", async () => {
    const { context } = await createFixture();
    const tiff = await solidImage("tiff", 120, 90);

    await expectUploadError(
      uploadAsset(context, { fileName: "scan.tiff", bytes: tiff }),
      "unsupported-type",
    );
    await expectUploadError(
      uploadAsset(context, { fileName: "notes.txt", bytes: Buffer.from("not an image") }),
      "invalid-image",
    );
    await expectUploadError(
      uploadAsset(context, { fileName: "empty.png", bytes: new Uint8Array() }),
      "invalid-image",
    );
    await expect(listAssets(context)).resolves.toEqual([]);
  });

  it("keeps animation in the original GIF but stores static first-frame variants", async () => {
    const { context } = await createFixture();
    const bytes = await animatedGif(120, 80, 3);

    const summary = await uploadAsset(context, { fileName: "loop.gif", bytes });

    expect(summary.mimeType).toBe("image/gif");
    expect(summary.width).toBe(120);
    expect(summary.height).toBe(80);
    expect(summary.variants.find((variant) => variant.variant === "original")).toMatchObject({
      width: 120,
      height: 80,
    });
    const original = await getAssetVariantFile(context, summary.id, "original");
    expect(original?.mimeType).toBe("image/gif");
    const originalBytes = await readFile(original?.path ?? "");
    expect(originalBytes.equals(bytes)).toBe(true);
    await expect(sharp(original?.path, { animated: true }).metadata()).resolves.toMatchObject({
      format: "gif",
      pages: 3,
    });

    for (const variant of ["display", "thumb"] as const) {
      const generated = await getAssetVariantFile(context, summary.id, variant);
      expect(generated?.mimeType).toBe("image/webp");
      const metadata = await sharp(generated?.path, { animated: true }).metadata();
      expect(metadata.format).toBe("webp");
      expect(metadata.pages ?? 1).toBe(1);
      expect(metadata.width ?? 0).toBeLessThanOrEqual(120);
    }
  });

  it("tracks references, lists orphans and stays idempotent", async () => {
    const { context } = await createFixture();
    const used = await uploadAsset(context, { fileName: "used.png", bytes: await solidImage("png", 300, 200) });
    const orphan = await uploadAsset(context, {
      fileName: "orphan.png",
      bytes: await solidImage("png", 300, 200),
    });
    const usedAddress = used.variants.find((variant) => variant.variant === "display")?.address;

    await syncAssetReferences(context, {
      contentKind: "article",
      contentId: "article-1",
      body: `![hero](${usedAddress}) and again ${usedAddress}`,
    });

    let assets = await listAssets(context);
    expect(findAsset(assets, used.id).references).toEqual([
      { contentKind: "article", contentId: "article-1" },
    ]);
    expect(findAsset(assets, used.id).isOrphan).toBe(false);
    expect(findAsset(assets, orphan.id).isOrphan).toBe(true);

    const orphanList = await listOrphanAssets(context);
    expect(orphanList.map((asset) => asset.id)).toEqual([orphan.id]);

    await syncAssetReferences(context, {
      contentKind: "article",
      contentId: "article-1",
      body: `![hero](${usedAddress}) and again ${usedAddress}`,
    });
    assets = await listAssets(context);
    expect(findAsset(assets, used.id).references).toHaveLength(1);

    const orphanAddress = orphan.variants.find((variant) => variant.variant === "thumb")?.address;
    await syncAssetReferences(context, {
      contentKind: "article",
      contentId: "article-1",
      body: `![swapped](${orphanAddress})`,
    });

    assets = await listAssets(context);
    expect(findAsset(assets, used.id).isOrphan).toBe(true);
    expect(findAsset(assets, orphan.id).references).toEqual([
      { contentKind: "article", contentId: "article-1" },
    ]);
    expect((await listOrphanAssets(context)).map((asset) => asset.id)).toEqual([used.id]);
  });

  it("only registers references to assets that exist", async () => {
    const { context } = await createFixture();
    const asset = await uploadAsset(context, {
      fileName: "kept.png",
      bytes: await solidImage("png", 200, 150),
    });
    const missingId = randomUUID();

    await syncAssetReferences(context, {
      contentKind: "post",
      contentId: "post-1",
      body: `/media/${missingId}/display.webp`,
    });

    await expect(listAssets(context)).resolves.toEqual([asset]);
    await expect(listOrphanAssets(context)).resolves.toEqual([asset]);

    await syncAssetReferences(context, {
      contentKind: "post",
      contentId: "post-2",
      body: "no media references",
    });
    await expect(listOrphanAssets(context)).resolves.toEqual([asset]);
  });

  it("deletes orphan assets, refuses referenced ones and reports missing ones", async () => {
    const { context } = await createFixture();
    const bytes = await solidImage("png", 400, 300);
    const referenced = await uploadAsset(context, { fileName: "referenced.png", bytes });
    const orphan = await uploadAsset(context, { fileName: "orphan.png", bytes });
    const address = referenced.variants.find((variant) => variant.variant === "display")?.address;

    await syncAssetReferences(context, {
      contentKind: "article",
      contentId: "article-1",
      body: String(address),
    });

    await expect(deleteAsset(context, referenced.id)).resolves.toEqual({
      deleted: false,
      reason: "referenced",
    });
    const keptFile = await getAssetVariantFile(context, referenced.id, "original");
    expect(keptFile).not.toBeNull();
    await expect(stat(keptFile?.path ?? "")).resolves.toMatchObject({ size: bytes.byteLength });

    await expect(deleteAsset(context, orphan.id)).resolves.toEqual({ deleted: true });
    await expect(getAssetVariantFile(context, orphan.id, "original")).resolves.toBeNull();
    await expect(stat(context.files.assetDir(orphan.id))).rejects.toMatchObject({ code: "ENOENT" });

    await expect(deleteAsset(context, orphan.id)).resolves.toEqual({
      deleted: false,
      reason: "not-found",
    });
    await expect(deleteAsset(context, randomUUID())).resolves.toEqual({
      deleted: false,
      reason: "not-found",
    });
    await expect(listAssets(context)).resolves.toHaveLength(1);
  });

  it("deletes the record even when the file removal fails, leaving no broken record", async () => {
    const { context } = await createFixture();
    const bytes = await solidImage("png", 320, 240);
    const orphan = await uploadAsset(context, { fileName: "orphan.png", bytes });

    await expect(deleteAsset(withFailingRemove(context), orphan.id)).resolves.toEqual({
      deleted: true,
    });

    await expect(listAssets(context)).resolves.toEqual([]);
    await expect(getAssetVariantFile(context, orphan.id, "original")).resolves.toBeNull();
    await expect(deleteAsset(context, orphan.id)).resolves.toEqual({
      deleted: false,
      reason: "not-found",
    });
  });

  it("serves a variant file only when the requested format matches the stored one", async () => {
    const { context } = await createFixture();
    const summary = await uploadAsset(context, { fileName: "hero.png", bytes: await solidImage("png", 300, 200) });

    await expect(getAssetVariantFile(context, summary.id, "original", "webp")).resolves.toBeNull();
    await expect(getAssetVariantFile(context, summary.id, "original", "png")).resolves.toMatchObject({
      mimeType: "image/png",
    });
    await expect(getAssetVariantFile(context, summary.id, "display", "webp")).resolves.toMatchObject({
      mimeType: "image/webp",
    });
    await expect(getAssetVariantFile(context, randomUUID(), "display", "webp")).resolves.toBeNull();
  });
});

function withFailingRemove(context: AssetContext): AssetContext {
  const files: AssetFileStore = Object.create(Object.getPrototypeOf(context.files) as object);
  Object.assign(files, context.files, {
    removeAsset: async () => {
      throw new Error("disk failure");
    },
  });
  return { ...context, files };
}
