import { cookies, headers } from "next/headers";

import { AdminPageHead } from "@/components/admin/page-head";
import { NewWorkButton } from "@/components/admin/new-work-button";
import { PostList } from "@/components/admin/post-list";
import { negotiateLocale } from "@/domain/locale";
import { messages } from "@/messages";
import { getAppContext } from "@/server/app-context";
import { listPosts } from "@/services/posts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function AdminPostsPage() {
  const cookieStore = await cookies();
  const locale = negotiateLocale(
    (await headers()).get("accept-language"),
    cookieStore.get("soli-locale")?.value ?? null,
  );
  const t = messages[locale];
  const posts = await listPosts(getAppContext().posts);

  return (
    <>
      <AdminPageHead
        title={t.admin.posts.title}
        description={t.admin.posts.description}
        actions={
          <NewWorkButton
            kind="post"
            locale={locale}
            label={t.admin.posts.newPost}
            failedLabel={t.admin.articles.meta.createFailed}
          />
        }
      />
      <PostList posts={posts} labels={t.admin.posts} />
    </>
  );
}
