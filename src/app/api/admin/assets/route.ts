import { listAssetsResponse, uploadAssetResponse } from "@/http/assets";
import { getAppContext } from "@/server/app-context";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const context = getAppContext();
  return listAssetsResponse(context.assets, context.auth, request);
}

export async function POST(request: Request): Promise<Response> {
  const context = getAppContext();
  return uploadAssetResponse(context.assets, context.auth, request);
}
