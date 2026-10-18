import { cookies, headers } from "next/headers";

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
      <h1>{t.admin.posts.title}</h1>
      <p>{t.admin.posts.description}</p>
      <PostList posts={posts} locale={locale} labels={t.admin.posts} />
    </>
  );
}
