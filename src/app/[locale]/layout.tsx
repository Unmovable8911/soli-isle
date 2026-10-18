import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { SiteShell } from "@/components/site-shell";
import { isLocale } from "@/config/site";
import { messages } from "@/messages";
import { getAppContext } from "@/server/app-context";
import { listReaderCategories } from "@/services/reading";
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
  // The tree belongs to every public page now, so it is read here rather than
  // by each one: one query for the shell, not one per surface.
  const categories = await listReaderCategories(getAppContext().reading, { locale });

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
          categoriesHeading={t.reader.category.heading}
          categories={categories}
        >
          {children}
        </SiteShell>
      </body>
    </html>
  );
}
