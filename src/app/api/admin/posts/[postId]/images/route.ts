import { setPostImagesResponse } from "@/http/posts";
import { getAppContext } from "@/server/app-context";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ postId: string }> },
): Promise<Response> {
  const { postId } = await params;
  const context = getAppContext();
  return setPostImagesResponse(context.posts, context.auth, request, postId);
}
