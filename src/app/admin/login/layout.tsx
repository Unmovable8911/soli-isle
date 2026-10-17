import { negotiateLocale } from "@/domain/locale";
import { cookies, headers } from "next/headers";
import type { ReactNode } from "react";

import AdminDocument from "../admin-document";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function AdminLoginLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const cookieStore = await cookies();
  const locale = negotiateLocale(
    (await headers()).get("accept-language"),
    cookieStore.get("soli-locale")?.value ?? null,
  );

  return (
    <AdminDocument locale={locale}>
      <main>{children}</main>
    </AdminDocument>
  );
}
