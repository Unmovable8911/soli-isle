import type { Metadata } from "next";
import { headers } from "next/headers";

import { NotFoundView } from "@/components/not-found-view";
import { requestLocale } from "@/components/request-locale";
import { SiteShell } from "@/components/site-shell";
import { LOCALE_HEADER } from "@/domain/locale";
import { messages } from "@/messages";

import { themeInitScript } from "./theme-init";

import "katex/dist/katex.min.css";
import "./globals.css";

/**
 * The 404 document. The public site and the console are two root layouts, so a
 * notFound() thrown by a page has no one root layout to render into; without
 * this file Next answers with a client-only error document that has no
 * stylesheet and is blank with JavaScript off. Here the page is a real one: the
 * reader's own shell, the site's stylesheet, and its Locale read from the
 * address the middleware recorded.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function GlobalNotFound() {
  const requestHeaders = await headers();
  const locale = requestLocale(requestHeaders.get(LOCALE_HEADER));
  const t = messages[locale];

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <script data-theme-init dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <SiteShell
          locale={locale}
          chrome={t.chrome}
          nav={t.reader.nav}
          search={t.reader.search}
        >
          <NotFoundView locale={locale} />
        </SiteShell>
      </body>
    </html>
  );
}
