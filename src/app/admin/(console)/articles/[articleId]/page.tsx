import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";

import ArticleEditor from "@/components/admin/article-editor";
import { negotiateLocale } from "@/domain/locale";
import { messages } from "@/messages";
import { getAppContext } from "@/server/app-context";
import { getArticle } from "@/services/articles";
import { listCategoryTree } from "@/services/categories";
import { listTags } from "@/services/tags";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function AdminArticlePage({
  params,
}: {
  params: Promise<{ articleId: string }>;
}) {
  const { articleId } = await params;
  const cookieStore = await cookies();
  const locale = negotiateLocale(
    (await headers()).get("accept-language"),
    cookieStore.get("soli-locale")?.value ?? null,
  );
  const context = getAppContext();
  const article = await getArticle(context.articles, articleId);
  if (article === null) {
    notFound();
  }

  const [categories, tags] = await Promise.all([
    listCategoryTree(context.articles),
    listTags(context.articles),
  ]);
  const t = messages[locale];

  return (
    <ArticleEditor
      article={article}
      categories={categories}
      tags={tags}
      locale={locale}
      labels={t.admin.articles}
      assetLabels={t.admin.assets}
    />
  );
}
