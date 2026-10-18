import { removePostTranslationResponse, savePostTranslationResponse } from "@/http/posts";
import { getAppContext } from "@/server/app-context";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ postId: string; locale: string }>;
}

export async function PUT(request: Request, { params }: RouteParams): Promise<Response> {
  const { postId, locale } = await params;
  const context = getAppContext();
  return savePostTranslationResponse(context.posts, context.auth, request, postId, locale);
}

export async function DELETE(request: Request, { params }: RouteParams): Promise<Response> {
  const { postId, locale } = await params;
  const context = getAppContext();
  return removePostTranslationResponse(context.posts, context.auth, request, postId, locale);
}
