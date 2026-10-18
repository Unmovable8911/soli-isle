import { negotiateLocale } from "@/domain/locale";
import { messages } from "@/messages";
import { cookies, headers } from "next/headers";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function AdminHomePage() {
  const cookieStore = await cookies();
  const locale = negotiateLocale(
    (await headers()).get("accept-language"),
    cookieStore.get("soli-locale")?.value ?? null,
  );
  const t = messages[locale];

  return (
    <>
      <h1>{t.admin.home.title}</h1>
      <p>{t.admin.home.tagline}</p>
      <p>{t.admin.home.hint}</p>
      <p className="admin-home-entry">
        <Link href="/admin/articles">{t.admin.articles.title}</Link>
      </p>
      <p className="admin-home-entry">
        <Link href="/admin/posts">{t.admin.posts.title}</Link>
      </p>
      <p className="admin-home-entry">
        <Link href="/admin/assets">{t.admin.assets.title}</Link>
      </p>
    </>
  );
}
