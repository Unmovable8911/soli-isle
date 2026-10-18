import { createPostResponse, listPostsResponse } from "@/http/posts";
import { getAppContext } from "@/server/app-context";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const context = getAppContext();
  return listPostsResponse(context.posts, context.auth, request);
}

export async function POST(request: Request): Promise<Response> {
  const context = getAppContext();
  return createPostResponse(context.posts, context.auth, request);
}
