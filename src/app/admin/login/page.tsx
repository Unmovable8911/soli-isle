import { BrandMark } from "@/components/icons";
import { SESSION_COOKIE_NAME } from "@/config/auth";
import { negotiateLocale } from "@/domain/locale";
import { messages } from "@/messages";
import { verifyAuthorSession } from "@/services/auth";
import { getAppContext } from "@/server/app-context";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type LoginSearchParams = { error?: string | string[] };

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<LoginSearchParams>;
}) {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);
  if (
    sessionCookie &&
    verifyAuthorSession(getAppContext().auth, sessionCookie.value) !== null
  ) {
    redirect("/admin");
  }

  const { error } = await searchParams;
  const locale = negotiateLocale(
    (await headers()).get("accept-language"),
    cookieStore.get("soli-locale")?.value ?? null,
  );
  const t = messages[locale];
  const errorMessage =
    error === "invalid"
      ? t.admin.login.errorInvalid
      : error === "rate-limited"
        ? t.admin.login.errorRateLimited
        : null;

  return (
    <div className="admin-login">
      <div className="admin-login-card">
        <span className="admin-login-wordmark">
          <BrandMark size={24} />
          {t.chrome.siteName}
        </span>
        <h1>{t.admin.login.title}</h1>
        {errorMessage !== null ? <p role="alert">{errorMessage}</p> : null}
        <form action="/admin/login/submit" method="post" className="admin-login-form">
          <label htmlFor="admin-password">{t.admin.login.passwordLabel}</label>
          <input
            id="admin-password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
          <button type="submit">{t.admin.login.submit}</button>
        </form>
      </div>
    </div>
  );
}
