import { describe, expect, it } from "vitest";
import {
  assetFileExtension,
  buildAssetAddress,
  extractAssetIds,
  isAssetVariant,
  parseAssetAddress,
} from "./asset-address";

const ASSET_ID = "4f8a1d0e-9b6e-4a3e-8f7c-2d1e5a6b7c8d";
const OTHER_ID = "9c2b7e41-5d3a-4f60-91e8-6a0d2c4b8f13";

describe("asset addresses", () => {
  it("builds a stable relative address per variant", () => {
    expect(buildAssetAddress({ assetId: ASSET_ID, variant: "original", format: "jpeg" })).toBe(
      `/media/${ASSET_ID}/original.jpg`,
    );
    expect(buildAssetAddress({ assetId: ASSET_ID, variant: "display", format: "webp" })).toBe(
      `/media/${ASSET_ID}/display.webp`,
    );
    expect(buildAssetAddress({ assetId: ASSET_ID, variant: "thumb", format: "webp" })).toBe(
      `/media/${ASSET_ID}/thumb.webp`,
    );
  });

  it("maps real image formats to file extensions", () => {
    expect(assetFileExtension("jpeg")).toBe("jpg");
    expect(assetFileExtension("png")).toBe("png");
    expect(assetFileExtension("webp")).toBe("webp");
    expect(assetFileExtension("avif")).toBe("avif");
    expect(assetFileExtension("gif")).toBe("gif");
  });

  it("refuses to build an address from an unsafe asset id", () => {
    expect(() => buildAssetAddress({ assetId: "../etc/passwd", variant: "original", format: "png" }))
      .toThrow();
    expect(() =>
      buildAssetAddress({ assetId: "https://example.com/x", variant: "display", format: "webp" }),
    ).toThrow();
  });

  it("refuses to build non-webp display and thumb addresses", () => {
    expect(() =>
      buildAssetAddress({ assetId: ASSET_ID, variant: "display", format: "jpeg" }),
    ).toThrow();
  });

  it("parses every variant back to its parts", () => {
    expect(parseAssetAddress(`/media/${ASSET_ID}/original.png`)).toEqual({
      assetId: ASSET_ID,
      variant: "original",
      format: "png",
      address: `/media/${ASSET_ID}/original.png`,
    });
    expect(parseAssetAddress(`/media/${ASSET_ID}/original.jpg`)).toMatchObject({
      variant: "original",
      format: "jpeg",
    });
    expect(parseAssetAddress(`/media/${ASSET_ID}/display.webp`)).toEqual({
      assetId: ASSET_ID,
      variant: "display",
      format: "webp",
      address: `/media/${ASSET_ID}/display.webp`,
    });
    expect(parseAssetAddress(`/media/${ASSET_ID}/thumb.webp`)).toMatchObject({ variant: "thumb" });
  });

  it("rejects absolute, protocol-relative and malformed addresses", () => {
    expect(parseAssetAddress(`https://example.com/media/${ASSET_ID}/display.webp`)).toBeNull();
    expect(parseAssetAddress(`//example.com/media/${ASSET_ID}/display.webp`)).toBeNull();
    expect(parseAssetAddress(`/media/${ASSET_ID}/display.webp?a=1`)).toBeNull();
    expect(parseAssetAddress(`/media/${ASSET_ID}/display`)).toBeNull();
    expect(parseAssetAddress(`/media/${ASSET_ID}/preview.webp`)).toBeNull();
    expect(parseAssetAddress(`/media/${ASSET_ID}/display.png`)).toBeNull();
    expect(parseAssetAddress(`/media/${ASSET_ID}/original.bmp`)).toBeNull();
    expect(parseAssetAddress(`/media/${ASSET_ID}/Display.webp`)).toBeNull();
    expect(parseAssetAddress(`/media/not-an-id/display.webp`)).toBeNull();
    expect(parseAssetAddress(`/media/${ASSET_ID}/nested/display.webp`)).toBeNull();
    expect(parseAssetAddress("")).toBeNull();
  });

  it("recognizes variant names only from the fixed set", () => {
    expect(isAssetVariant("original")).toBe(true);
    expect(isAssetVariant("display")).toBe(true);
    expect(isAssetVariant("thumb")).toBe(true);
    expect(isAssetVariant("preview")).toBe(false);
  });

  it("extracts unique asset ids from mixed markdown and ProseMirror JSON bodies", () => {
    const markdown = [
      `![hero](/media/${ASSET_ID}/display.webp)`,
      `![thumb](/media/${ASSET_ID}/thumb.webp)`,
      `Again: /media/${ASSET_ID}/original.jpg`,
      `![other](/media/${OTHER_ID}/display.webp)`,
      `![other again](/media/${OTHER_ID}/thumb.webp)`,
    ].join("\n\n");
    const prosemirror = JSON.stringify({
      type: "doc",
      content: [
        {
          type: "image",
          attrs: { src: `/media/${OTHER_ID}/display.webp` },
        },
      ],
    });

    expect(extractAssetIds(markdown)).toEqual([ASSET_ID, OTHER_ID]);
    expect(extractAssetIds(prosemirror)).toEqual([OTHER_ID]);
    expect(extractAssetIds("no images here")).toEqual([]);
  });

  it("ignores absolute URLs, invalid ids and unsupported variants while extracting", () => {
    const body = [
      `https://example.com/media/${ASSET_ID}/display.webp`,
      `//cdn.example.com/media/${ASSET_ID}/thumb.webp`,
      `/media/${ASSET_ID}/preview.webp`,
      `/media/not-a-uuid/display.webp`,
      `/media/${OTHER_ID}/display.png`,
      `/media/${OTHER_ID}/display.webp`,
    ].join(" ");

    expect(extractAssetIds(body)).toEqual([OTHER_ID]);
  });
});
