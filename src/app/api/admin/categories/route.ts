import { createCategoryResponse, listCategoriesResponse } from "@/http/catalogue";
import { getAppContext } from "@/server/app-context";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const context = getAppContext();
  return listCategoriesResponse(context.articles, context.auth, request);
}

export async function POST(request: Request): Promise<Response> {
  const context = getAppContext();
  return createCategoryResponse(context.articles, context.auth, request);
}
