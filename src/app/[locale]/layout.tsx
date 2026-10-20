import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { SiteShell } from "@/components/site-shell";
import { isLocale } from "@/config/site";
import { messages } from "@/messages";
import { themeInitScript } from "../theme-init";

import "katex/dist/katex.min.css";
import "../globals.css";

type LocaleParams = { locale: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<LocaleParams>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) {
    return {};
  }

  const t = messages[locale];
  return {
    title: t.meta.title,
    description: t.meta.description,
  };
}

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: ReactNode;
  params: Promise<LocaleParams>;
}>) {
  const { locale } = await params;
  if (!isLocale(locale)) {
    notFound();
  }

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
          {children}
        </SiteShell>
      </body>
    </html>
  );
}
