import { feedResponse } from "@/http/posts";
import { getAppContext } from "@/server/app-context";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** The "load older" page. No session: this is a Reader surface. */
export async function GET(request: Request): Promise<Response> {
  const context = getAppContext();
  return feedResponse(context.posts, request);
}
