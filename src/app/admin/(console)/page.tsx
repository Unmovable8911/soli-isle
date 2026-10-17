import { negotiateLocale } from "@/domain/locale";
import { messages } from "@/messages";
import { cookies, headers } from "next/headers";

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
    </>
  );
}
