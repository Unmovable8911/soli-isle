import { cookies, headers } from "next/headers";

import { ArticleList } from "@/components/admin/article-list";
import { AdminPageHead } from "@/components/admin/page-head";
import { NewWorkButton } from "@/components/admin/new-work-button";
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
      <AdminPageHead
        title={t.admin.articles.title}
        description={t.admin.articles.description}
        actions={
          <NewWorkButton
            kind="article"
            locale={locale}
            label={t.admin.articles.newArticle}
            failedLabel={t.admin.articles.meta.createFailed}
          />
        }
      />
      <ArticleList articles={articles} labels={t.admin.articles} />
    </>
  );
}
