import { savePostTranslationResponse } from "@/http/posts";
import { getAppContext } from "@/server/app-context";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ postId: string; locale: string }> },
): Promise<Response> {
  const { postId, locale } = await params;
  const context = getAppContext();
  return savePostTranslationResponse(context.posts, context.auth, request, postId, locale);
}
