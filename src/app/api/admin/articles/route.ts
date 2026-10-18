import { createArticleResponse, listArticlesResponse } from "@/http/articles";
import { getAppContext } from "@/server/app-context";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const context = getAppContext();
  return listArticlesResponse(context.articles, context.auth, request);
}

export async function POST(request: Request): Promise<Response> {
  const context = getAppContext();
  return createArticleResponse(context.articles, context.auth, request);
}
