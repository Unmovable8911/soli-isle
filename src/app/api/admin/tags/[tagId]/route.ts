import { deleteTagResponse, updateTagResponse } from "@/http/catalogue";
import { getAppContext } from "@/server/app-context";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ tagId: string }> },
): Promise<Response> {
  const { tagId } = await params;
  const context = getAppContext();
  return updateTagResponse(context.articles, context.auth, request, tagId);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ tagId: string }> },
): Promise<Response> {
  const { tagId } = await params;
  const context = getAppContext();
  return deleteTagResponse(context.articles, context.auth, request, tagId);
}
