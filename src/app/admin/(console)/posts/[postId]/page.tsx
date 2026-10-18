import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";

import PostComposer from "@/components/admin/post-composer";
import { negotiateLocale } from "@/domain/locale";
import { messages } from "@/messages";
import { getAppContext } from "@/server/app-context";
import { getPost } from "@/services/posts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function AdminPostPage({
  params,
}: {
  params: Promise<{ postId: string }>;
}) {
  const { postId } = await params;
  const context = getAppContext();
  const post = await getPost(context.posts, postId);
  if (post === null) {
    notFound();
  }

  const cookieStore = await cookies();
  const locale = negotiateLocale(
    (await headers()).get("accept-language"),
    cookieStore.get("soli-locale")?.value ?? null,
  );
  const t = messages[locale];

  return (
    <>
      <h1>{t.admin.posts.title}</h1>
      <PostComposer
        post={post}
        locale={locale}
        labels={t.admin.posts}
        assetLabels={t.admin.assets}
      />
    </>
  );
}
