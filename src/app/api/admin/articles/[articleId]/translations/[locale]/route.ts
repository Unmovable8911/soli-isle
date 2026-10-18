import { removeTranslationResponse, saveTranslationResponse } from "@/http/articles";
import { getAppContext } from "@/server/app-context";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ articleId: string; locale: string }>;
}

export async function PUT(request: Request, { params }: RouteParams): Promise<Response> {
  const { articleId, locale } = await params;
  const context = getAppContext();
  return saveTranslationResponse(context.articles, context.auth, request, articleId, locale);
}

export async function DELETE(request: Request, { params }: RouteParams): Promise<Response> {
  const { articleId, locale } = await params;
  const context = getAppContext();
  return removeTranslationResponse(context.articles, context.auth, request, articleId, locale);
}
