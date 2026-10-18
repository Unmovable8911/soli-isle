import { cookies, headers } from "next/headers";

import { TagManager } from "@/components/admin/tag-manager";
import { negotiateLocale } from "@/domain/locale";
import { messages } from "@/messages";
import { getAppContext } from "@/server/app-context";
import { listTags } from "@/services/tags";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function AdminTagsPage() {
  const cookieStore = await cookies();
  const locale = negotiateLocale(
    (await headers()).get("accept-language"),
    cookieStore.get("soli-locale")?.value ?? null,
  );
  const t = messages[locale];
  const tags = await listTags(getAppContext().articles);

  return (
    <>
      <h1>{t.admin.tags.title}</h1>
      <p>{t.admin.tags.description}</p>
      <TagManager
        tags={tags}
        locale={locale}
        labels={t.admin.tags}
        localeNames={t.chrome.localeNames}
      />
    </>
  );
}
