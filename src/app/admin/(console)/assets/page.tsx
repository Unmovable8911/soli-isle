import { cookies, headers } from "next/headers";

import AssetLibrary from "@/components/admin/asset-library";
import { negotiateLocale } from "@/domain/locale";
import { messages } from "@/messages";
import { getAppContext } from "@/server/app-context";
import { listAssets } from "@/services/assets";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function AdminAssetsPage() {
  const cookieStore = await cookies();
  const locale = negotiateLocale(
    (await headers()).get("accept-language"),
    cookieStore.get("soli-locale")?.value ?? null,
  );
  const t = messages[locale];
  const assets = await listAssets(getAppContext().assets);

  return (
    <>
      <h1>{t.admin.assets.title}</h1>
      <p>{t.admin.assets.description}</p>
      <AssetLibrary assets={assets} locale={locale} labels={t.admin.assets} />
    </>
  );
}
