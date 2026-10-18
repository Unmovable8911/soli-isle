import { AdminNav } from "@/components/admin/admin-nav";
import { SESSION_COOKIE_NAME } from "@/config/auth";
import { negotiateLocale } from "@/domain/locale";
import { messages } from "@/messages";
import { verifyAuthorSession } from "@/services/auth";
import { getAppContext } from "@/server/app-context";
import { cookies, headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import AdminDocument from "../admin-document";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function AdminConsoleLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const cookieStore = await cookies();
  const requestHeaders = await headers();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);

  if (!sessionCookie) {
    redirect("/admin/login");
  }

  const session = verifyAuthorSession(getAppContext().auth, sessionCookie.value);
  if (session === null) {
    redirect("/admin/login");
  }

  const locale = negotiateLocale(
    requestHeaders.get("accept-language"),
    cookieStore.get("soli-locale")?.value ?? null,
  );
  const t = messages[locale];

  return (
    <AdminDocument locale={locale}>
      <header className="admin-topbar">
        <Link href="/admin" className="site-name">
          {t.chrome.siteName}
        </Link>
        <span className="admin-badge">{t.admin.shell.badge}</span>
        <AdminNav shell={t.admin.shell} />
        <form action="/admin/logout" method="post">
          <button type="submit">{t.admin.shell.logout}</button>
        </form>
      </header>
      <main>{children}</main>
    </AdminDocument>
  );
}
