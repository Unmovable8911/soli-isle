import { cookies, headers } from "next/headers";

import { AdminPageHead } from "@/components/admin/page-head";
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
      <AdminPageHead
        title={t.admin.tags.title}
        description={t.admin.tags.description}
        actions={
          <a className="admin-page-action" href="#tag-create">
            {t.admin.tags.create.title}
          </a>
        }
      />
      <TagManager
        tags={tags}
        locale={locale}
        labels={t.admin.tags}
        localeNames={t.chrome.localeNames}
      />
    </>
  );
}
