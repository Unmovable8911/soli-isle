import { mediaFileResponse } from "@/http/assets";
import { getAppContext } from "@/server/app-context";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ assetId: string; variant: string }> },
): Promise<Response> {
  const { assetId, variant } = await params;
  return mediaFileResponse(getAppContext().assets, assetId, variant);
}
