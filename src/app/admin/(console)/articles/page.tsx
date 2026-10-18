import { cookies, headers } from "next/headers";

import { ArticleList } from "@/components/admin/article-list";
import { negotiateLocale } from "@/domain/locale";
import { messages } from "@/messages";
import { getAppContext } from "@/server/app-context";
import { listArticles } from "@/services/articles";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function AdminArticlesPage() {
  const cookieStore = await cookies();
  const locale = negotiateLocale(
    (await headers()).get("accept-language"),
    cookieStore.get("soli-locale")?.value ?? null,
  );
  const t = messages[locale];
  const articles = await listArticles(getAppContext().articles);

  return (
    <>
      <h1>{t.admin.articles.title}</h1>
      <p>{t.admin.articles.description}</p>
      <ArticleList articles={articles} locale={locale} labels={t.admin.articles} />
    </>
  );
}
