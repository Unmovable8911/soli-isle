import { randomUUID } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import sharp from "sharp";
import { afterEach, describe, expect, it } from "vitest";
import { resolveAuthConfig } from "@/config/auth";
import { insertAuthorSession } from "@/db/auth-repository";
import { createAuthorAuthContext } from "@/services/auth";
import {
  createAssetContext,
  getAssetVariantFile,
  syncAssetReferences,
  uploadAsset,
  type AssetContext,
} from "@/services/assets";
import { createTestHarness, type TestHarness } from "@/test/harness";
import {
  deleteAssetResponse,
  listAssetsResponse,
  mediaFileResponse,
  uploadAssetResponse,
} from "./assets";

interface HttpFixture {
  harness: TestHarness;
  assets: AssetContext;
  auth: ReturnType<typeof createAuthorAuthContext>;
  cookie: string;
  close(): Promise<void>;
}

async function createHttpFixture(): Promise<HttpFixture> {
  const harness = await createTestHarness();
  const auth = createAuthorAuthContext(harness.database, harness.clock, resolveAuthConfig(), null);
  const sessionId = randomUUID();
  const now = harness.clock.now();
  insertAuthorSession(harness.database.db, {
    id: sessionId,
    createdAt: now,
    lastSeenAt: now,
    expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
  });

  return {
    harness,
    assets: createAssetContext(harness.database, harness.clock, harness.resources.rootDir),
    auth,
    cookie: `soli-session=${sessionId}`,
    close: () => harness.close(),
  };
}

async function pngBytes(width = 1200, height = 800): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 200, g: 40, b: 90 } },
  })
    .png()
    .toBuffer();
}

function adminRequest(
  path: string,
  init: RequestInit & { cookie?: string } = {},
): Request {
  const { cookie, ...rest } = init;
  const headers = new Headers(rest.headers);
  if (cookie) {
    headers.set("cookie", cookie);
  }
  return new Request(`http://localhost${path}`, { ...rest, headers });
}

function fileFrom(bytes: Uint8Array, name: string, type: string): File {
  return new File([new Uint8Array(bytes)], name, { type });
}

function uploadRequest(cookie: string | null, file: File): Request {
  const form = new FormData();
  form.set("file", file);
  return adminRequest("/api/admin/assets", {
    method: "POST",
    body: form,
    cookie: cookie ?? undefined,
  });
}

describe("admin asset HTTP adapter", () => {
  const fixtures: HttpFixture[] = [];

  async function fixture(): Promise<HttpFixture> {
    const created = await createHttpFixture();
    fixtures.push(created);
    return created;
  }

  afterEach(async () => {
    for (const entry of fixtures.splice(0)) {
      await entry.close();
    }
  });

  it("rejects unauthenticated list, upload and delete calls with 401 JSON", async () => {
    const { assets, auth } = await fixture();
    const id = randomUUID();

    const list = await listAssetsResponse(assets, auth, adminRequest("/api/admin/assets"));
    expect(list.status).toBe(401);
    await expect(list.json()).resolves.toEqual({ error: "unauthorized" });

    const upload = await uploadAssetResponse(
      assets,
      auth,
      uploadRequest(null, fileFrom(await pngBytes(), "hero.png", "image/png")),
    );
    expect(upload.status).toBe(401);
    await expect(upload.json()).resolves.toEqual({ error: "unauthorized" });

    const remove = await deleteAssetResponse(
      assets,
      auth,
      adminRequest(`/api/admin/assets/${id}`, { method: "DELETE" }),
      id,
    );
    expect(remove.status).toBe(401);
    await expect(remove.json()).resolves.toEqual({ error: "unauthorized" });

    const forged = await listAssetsResponse(
      assets,
      auth,
      adminRequest("/api/admin/assets", { cookie: "soli-session=forged" }),
    );
    expect(forged.status).toBe(401);
  });

  it("uploads through multipart, lists summaries and serves media bytes immutably", async () => {
    const { assets, auth, cookie } = await fixture();
    const bytes = await pngBytes(2000, 1200);

    const upload = await uploadAssetResponse(
      assets,
      auth,
      uploadRequest(cookie, fileFrom(bytes, "hero.png", "image/png")),
    );
    expect(upload.status).toBe(201);
    const summary = (await upload.json()) as {
      id: string;
      fileName: string;
      mimeType: string;
      width: number;
      height: number;
      byteSize: number;
      variants: { variant: string; address: string; format: string }[];
    };
    expect(summary.fileName).toBe("hero.png");
    expect(summary.mimeType).toBe("image/png");
    expect(summary.byteSize).toBe(bytes.byteLength);
    expect(summary.width).toBe(2000);
    expect(summary.height).toBe(1200);
    const display = summary.variants.find((variant) => variant.variant === "display");
    expect(display?.address).toBe(`/media/${summary.id}/display.webp`);
    const original = summary.variants.find((variant) => variant.variant === "original");
    expect(original?.address).toBe(`/media/${summary.id}/original.png`);

    const media = await mediaFileResponse(assets, summary.id, "display.webp");
    expect(media.status).toBe(200);
    expect(media.headers.get("content-type")).toBe("image/webp");
    expect(media.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
    const mediaBytes = Buffer.from(await media.arrayBuffer());
    expect(media.headers.get("content-length")).toBe(String(mediaBytes.byteLength));
    await expect(sharp(mediaBytes).metadata()).resolves.toMatchObject({
      format: "webp",
      width: 1600,
      height: 960,
    });

    const originalMedia = await mediaFileResponse(assets, summary.id, "original.png");
    expect(originalMedia.status).toBe(200);
    expect(originalMedia.headers.get("content-type")).toBe("image/png");
    expect((await originalMedia.arrayBuffer()).byteLength).toBe(bytes.byteLength);

    const list = await listAssetsResponse(
      assets,
      auth,
      adminRequest("/api/admin/assets", { cookie }),
    );
    expect(list.status).toBe(200);
    const payload = (await list.json()) as {
      assets: { id: string; fileName: string; isOrphan: boolean }[];
      orphans: { id: string }[];
    };
    expect(payload.assets).toHaveLength(1);
    expect(payload.assets[0]).toMatchObject({ id: summary.id, fileName: "hero.png", isOrphan: true });
    expect(payload.orphans.map((asset) => asset.id)).toEqual([summary.id]);
  });

  it("maps upload failures to 415, 413 and 422", async () => {
    const { assets, auth, cookie } = await fixture();
    const limited: AssetContext = { ...assets, maxUploadBytes: 32 };

    const unsupported = await uploadAssetResponse(
      assets,
      auth,
      uploadRequest(
        cookie,
        fileFrom(await sharp({ create: { width: 60, height: 60, channels: 3, background: "#123" } }).tiff().toBuffer(), "scan.tiff", "image/tiff"),
      ),
    );
    expect(unsupported.status).toBe(415);
    await expect(unsupported.json()).resolves.toEqual({ error: "unsupported-type" });

    const tooLarge = await uploadAssetResponse(
      limited,
      auth,
      uploadRequest(cookie, fileFrom(await pngBytes(200, 200), "big.png", "image/png")),
    );
    expect(tooLarge.status).toBe(413);
    await expect(tooLarge.json()).resolves.toEqual({ error: "too-large" });

    const invalid = await uploadAssetResponse(
      assets,
      auth,
      uploadRequest(cookie, fileFrom(Buffer.from("definitely not an image"), "notes.png", "image/png")),
    );
    expect(invalid.status).toBe(422);
    await expect(invalid.json()).resolves.toEqual({ error: "invalid-image" });

    const missing = await uploadAssetResponse(
      assets,
      auth,
      adminRequest("/api/admin/assets", { method: "POST", body: new FormData(), cookie }),
    );
    expect(missing.status).toBe(400);
  });

  it("deletes orphans with 204 and refuses referenced assets with 409", async () => {
    const { assets, auth, cookie, harness } = await fixture();
    const bytes = await pngBytes(400, 300);
    const summary = await uploadAsset(assets, { fileName: "hero.png", bytes });
    const display = summary.variants.find((variant) => variant.variant === "display");

    await syncAssetReferences(assets, {
      contentKind: "article",
      contentId: "article-1",
      body: `![hero](${display?.address})`,
    });

    const refusedUrl = `/api/admin/assets/${summary.id}`;
    const refused = await deleteAssetResponse(
      assets,
      auth,
      adminRequest(refusedUrl, { method: "DELETE", cookie }),
      summary.id,
    );
    expect(refused.status).toBe(409);
    await expect(refused.json()).resolves.toEqual({ error: "referenced" });
    const stillThere = await getAssetVariantFile(assets, summary.id, "original");
    expect(stillThere).not.toBeNull();
    await expect(stat(stillThere?.path ?? "")).resolves.toMatchObject({ size: bytes.byteLength });
    expect((await readFile(stillThere?.path ?? "")).equals(bytes)).toBe(true);

    await syncAssetReferences(assets, {
      contentKind: "article",
      contentId: "article-1",
      body: "removed the image",
    });

    const deleted = await deleteAssetResponse(
      assets,
      auth,
      adminRequest(refusedUrl, { method: "DELETE", cookie }),
      summary.id,
    );
    expect(deleted.status).toBe(204);
    await expect(mediaFileResponse(assets, summary.id, "original.png")).resolves.toMatchObject({
      status: 404,
    });

    const missing = await deleteAssetResponse(
      assets,
      auth,
      adminRequest(`/api/admin/assets/${randomUUID()}`, { method: "DELETE", cookie }),
      randomUUID(),
    );
    expect(missing.status).toBe(404);
    expect((await listAssetsResponse(assets, auth, adminRequest("/api/admin/assets", { cookie }))).status).toBe(200);
    expect(harness.database.sqlite.open).toBe(true);
  });

  it("returns 404 for unknown assets, unknown variants and mismatched extensions", async () => {
    const { assets, auth, cookie } = await fixture();
    const summary = await uploadAsset(assets, { fileName: "hero.png", bytes: await pngBytes(300, 200) });

    for (const [assetId, variant] of [
      [randomUUID(), "display.webp"],
      [summary.id, "preview.webp"],
      [summary.id, "original.avif"],
      ["not-a-uuid", "display.webp"],
    ] as const) {
      const response = await mediaFileResponse(assets, assetId, variant);
      expect(response.status).toBe(404);
    }

    expect(
      (await listAssetsResponse(assets, auth, adminRequest("/api/admin/assets", { cookie }))).status,
    ).toBe(200);
  });

  it("returns 404 when the address extension disagrees with the stored format", async () => {
    const { assets } = await fixture();
    const summary = await uploadAsset(assets, { fileName: "hero.png", bytes: await pngBytes(320, 240) });

    // 原图确实是 PNG，但地址声称为 .webp。
    const spoofedFormat = await mediaFileResponse(assets, summary.id, "original.webp");
    expect(spoofedFormat.status).toBe(404);
    expect(await spoofedFormat.text()).toBe("Not Found");

    // 生成变体永远是 WebP，.png 地址在地址解析阶段就不合法。
    const spoofedVariant = await mediaFileResponse(assets, summary.id, "display.png");
    expect(spoofedVariant.status).toBe(404);
    expect(await spoofedVariant.text()).toBe("Not Found");

    expect((await mediaFileResponse(assets, summary.id, "original.png")).status).toBe(200);
    expect((await mediaFileResponse(assets, summary.id, "display.webp")).status).toBe(200);
  });
});
