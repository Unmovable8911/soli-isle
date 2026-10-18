import { createTagResponse, listTagsResponse } from "@/http/catalogue";
import { getAppContext } from "@/server/app-context";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const context = getAppContext();
  return listTagsResponse(context.articles, context.auth, request);
}

export async function POST(request: Request): Promise<Response> {
  const context = getAppContext();
  return createTagResponse(context.articles, context.auth, request);
}
