import { readFile } from "node:fs/promises";
import { SESSION_COOKIE_NAME } from "@/config/auth";
import { parseAssetAddress } from "@/domain/asset-address";
import { verifyAuthorSession, type AuthorAuthContext } from "@/services/auth";
import {
  AssetUploadError,
  deleteAsset,
  getAssetVariantFile,
  listAssets,
  uploadAsset,
  type AssetContext,
  type AssetSummary,
} from "@/services/assets";
import { readCookieValue } from "./request-cookie";

const NO_STORE = { "cache-control": "no-store" } as const;
const IMMUTABLE = { "cache-control": "public, max-age=31536000, immutable" } as const;

const UPLOAD_ERROR_STATUS: Record<string, number> = {
  "unsupported-type": 415,
  "too-large": 413,
  "invalid-image": 422,
};

function jsonError(error: string, status: number): Response {
  return Response.json({ error }, { status, headers: NO_STORE });
}

function isAuthorized(auth: AuthorAuthContext, request: Request): boolean {
  const sessionId = readCookieValue(request.headers.get("cookie"), SESSION_COOKIE_NAME);
  return sessionId !== null && verifyAuthorSession(auth, sessionId) !== null;
}

export async function listAssetsResponse(
  assets: AssetContext,
  auth: AuthorAuthContext,
  request: Request,
): Promise<Response> {
  if (!isAuthorized(auth, request)) {
    return jsonError("unauthorized", 401);
  }

  const summaries = await listAssets(assets);
  return Response.json(
    {
      assets: summaries,
      orphans: summaries.filter((summary: AssetSummary) => summary.isOrphan),
    },
    { headers: NO_STORE },
  );
}

export async function uploadAssetResponse(
  assets: AssetContext,
  auth: AuthorAuthContext,
  request: Request,
): Promise<Response> {
  if (!isAuthorized(auth, request)) {
    return jsonError("unauthorized", 401);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return jsonError("invalid-form-data", 400);
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return jsonError("missing-file", 400);
  }

  try {
    const summary = await uploadAsset(assets, {
      fileName: file.name,
      bytes: new Uint8Array(await file.arrayBuffer()),
    });
    return Response.json(summary, { status: 201, headers: NO_STORE });
  } catch (error) {
    if (error instanceof AssetUploadError) {
      return jsonError(error.code, UPLOAD_ERROR_STATUS[error.code] ?? 400);
    }
    throw error;
  }
}

export async function deleteAssetResponse(
  assets: AssetContext,
  auth: AuthorAuthContext,
  request: Request,
  assetId: string,
): Promise<Response> {
  if (!isAuthorized(auth, request)) {
    return jsonError("unauthorized", 401);
  }

  const outcome = await deleteAsset(assets, assetId);
  if (outcome.deleted) {
    return new Response(null, { status: 204, headers: NO_STORE });
  }

  return jsonError(outcome.reason, outcome.reason === "referenced" ? 409 : 404);
}

export async function mediaFileResponse(
  assets: AssetContext,
  assetId: string,
  variantSegment: string,
): Promise<Response> {
  const parsed = parseAssetAddress(`/media/${assetId}/${variantSegment}`);
  if (parsed === null) {
    return notFound();
  }

  const file = await getAssetVariantFile(assets, parsed.assetId, parsed.variant, parsed.format);
  if (file === null) {
    return notFound();
  }

  let bytes: Buffer;
  try {
    bytes = await readFile(file.path);
  } catch {
    return notFound();
  }

  return new Response(new Uint8Array(bytes), {
    status: 200,
    headers: {
      ...IMMUTABLE,
      "content-type": file.mimeType,
      "content-length": String(bytes.byteLength),
    },
  });
}

function notFound(): Response {
  return new Response("Not Found", { status: 404, headers: NO_STORE });
}
