import { deletePostResponse, getPostResponse, updatePostResponse } from "@/http/posts";
import { getAppContext } from "@/server/app-context";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PostParams = { params: Promise<{ postId: string }> };

export async function GET(request: Request, { params }: PostParams): Promise<Response> {
  const { postId } = await params;
  const context = getAppContext();
  return getPostResponse(context.posts, context.auth, request, postId);
}

export async function PATCH(request: Request, { params }: PostParams): Promise<Response> {
  const { postId } = await params;
  const context = getAppContext();
  return updatePostResponse(context.posts, context.auth, request, postId);
}

export async function DELETE(request: Request, { params }: PostParams): Promise<Response> {
  const { postId } = await params;
  const context = getAppContext();
  return deletePostResponse(context.posts, context.auth, request, postId);
}
