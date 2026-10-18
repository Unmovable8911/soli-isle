import { restoreRevisionResponse } from "@/http/articles";
import { getAppContext } from "@/server/app-context";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ articleId: string; revisionId: string }> },
): Promise<Response> {
  const { articleId, revisionId } = await params;
  const context = getAppContext();
  return restoreRevisionResponse(context.articles, context.auth, request, articleId, revisionId);
}
