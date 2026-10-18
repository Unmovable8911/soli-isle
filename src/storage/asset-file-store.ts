import { randomUUID } from "node:crypto";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  assetFileExtension,
  isAssetFormat,
  isAssetVariant,
  isSafeAssetId,
  type AssetFormat,
  type AssetVariant,
} from "@/domain/asset-address";

export class AssetFileStore {
  readonly rootDir: string;

  constructor(rootDir: string) {
    this.rootDir = path.resolve(rootDir);
  }

  assetDir(assetId: string): string {
    if (!isSafeAssetId(assetId)) {
      throw new Error("Asset id must be a UUID");
    }
    return path.join(this.rootDir, "assets", assetId);
  }

  variantPath(assetId: string, variant: AssetVariant, format: AssetFormat): string {
    if (!isAssetVariant(variant)) {
      throw new Error(`Unsupported asset variant: ${String(variant)}`);
    }
    if (!isAssetFormat(format)) {
      throw new Error(`Unsupported asset format: ${String(format)}`);
    }
    return path.join(this.assetDir(assetId), `${variant}.${assetFileExtension(format)}`);
  }

  async writeVariantFile(
    assetId: string,
    variant: AssetVariant,
    format: AssetFormat,
    bytes: Uint8Array,
  ): Promise<string> {
    const directory = this.assetDir(assetId);
    const targetPath = this.variantPath(assetId, variant, format);
    const temporaryPath = path.join(directory, `.${variant}.${randomUUID()}.tmp`);

    await mkdir(directory, { recursive: true });
    try {
      await writeFile(temporaryPath, bytes, { flag: "wx" });
      await rename(temporaryPath, targetPath);
    } catch (error) {
      await rm(temporaryPath, { force: true });
      throw error;
    }

    return targetPath;
  }

  async removeAsset(assetId: string): Promise<void> {
    await rm(this.assetDir(assetId), { recursive: true, force: true });
  }
}
