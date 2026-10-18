import { addTranslationResponse } from "@/http/articles";
import { getAppContext } from "@/server/app-context";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ articleId: string }> },
): Promise<Response> {
  const { articleId } = await params;
  const context = getAppContext();
  return addTranslationResponse(context.articles, context.auth, request, articleId);
}
