import { deleteCategoryResponse, updateCategoryResponse } from "@/http/catalogue";
import { getAppContext } from "@/server/app-context";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ categoryId: string }> },
): Promise<Response> {
  const { categoryId } = await params;
  const context = getAppContext();
  return updateCategoryResponse(context.articles, context.auth, request, categoryId);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ categoryId: string }> },
): Promise<Response> {
  const { categoryId } = await params;
  const context = getAppContext();
  return deleteCategoryResponse(context.articles, context.auth, request, categoryId);
}
