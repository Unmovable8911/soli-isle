import { deleteAssetResponse } from "@/http/assets";
import { getAppContext } from "@/server/app-context";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ assetId: string }> },
): Promise<Response> {
  const { assetId } = await params;
  const context = getAppContext();
  return deleteAssetResponse(context.assets, context.auth, request, assetId);
}
