import {
  deleteArticleResponse,
  getArticleResponse,
  updateArticleResponse,
} from "@/http/articles";
import { getAppContext } from "@/server/app-context";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ articleId: string }>;
}

export async function GET(request: Request, { params }: RouteParams): Promise<Response> {
  const { articleId } = await params;
  const context = getAppContext();
  return getArticleResponse(context.articles, context.auth, request, articleId);
}

export async function PATCH(request: Request, { params }: RouteParams): Promise<Response> {
  const { articleId } = await params;
  const context = getAppContext();
  return updateArticleResponse(context.articles, context.auth, request, articleId);
}

export async function DELETE(request: Request, { params }: RouteParams): Promise<Response> {
  const { articleId } = await params;
  const context = getAppContext();
  return deleteArticleResponse(context.articles, context.auth, request, articleId);
}
