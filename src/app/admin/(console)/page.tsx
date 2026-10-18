import { cookies, headers } from "next/headers";

import { LifecycleActions } from "@/components/admin/dashboard-actions";
import { DashboardTable } from "@/components/admin/dashboard-table";
import { negotiateLocale } from "@/domain/locale";
import { messages } from "@/messages";
import { getAppContext } from "@/server/app-context";
import { listArticles } from "@/services/articles";
import { listPosts } from "@/services/posts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * The Author's dashboard. Both lists arrive from the services, which is where a
 * work's Publication State is derived; this page only picks a label for it.
 */
export default async function AdminHomePage() {
  const cookieStore = await cookies();
  const locale = negotiateLocale(
    (await headers()).get("accept-language"),
    cookieStore.get("soli-locale")?.value ?? null,
  );
  const t = messages[locale];
  const context = getAppContext();
  const [articles, posts] = await Promise.all([
    listArticles(context.articles),
    listPosts(context.posts),
  ]);

  return (
    <>
      <h1>{t.admin.dashboard.title}</h1>
      <p>{t.admin.dashboard.tagline}</p>
      <DashboardTable
        articles={articles}
        posts={posts}
        labels={t.admin.dashboard}
        renderActions={(row) => (
          <LifecycleActions
            kind={row.kind}
            targetId={row.id}
            visibility={row.visibility}
            labels={t.admin.dashboard}
          />
        )}
      />
    </>
  );
}
