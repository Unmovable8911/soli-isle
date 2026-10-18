import { cookies, headers } from "next/headers";

import { CategoryManager } from "@/components/admin/category-manager";
import { negotiateLocale } from "@/domain/locale";
import { messages } from "@/messages";
import { getAppContext } from "@/server/app-context";
import { listCategoryTree } from "@/services/categories";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function AdminCategoriesPage() {
  const cookieStore = await cookies();
  const locale = negotiateLocale(
    (await headers()).get("accept-language"),
    cookieStore.get("soli-locale")?.value ?? null,
  );
  const t = messages[locale];
  const tree = await listCategoryTree(getAppContext().articles);

  return (
    <>
      <h1>{t.admin.categories.title}</h1>
      <p>{t.admin.categories.description}</p>
      <CategoryManager
        tree={tree}
        locale={locale}
        labels={t.admin.categories}
        localeNames={t.chrome.localeNames}
      />
    </>
  );
}
