import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";

import LocaleSwitcher from "@/components/locale-switcher";
import { SiteNav } from "@/components/site-nav";
import { SkipLink } from "@/components/skip-link";
import ThemeToggle from "@/components/theme-toggle";
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
        <SkipLink label={t.chrome.skipToContent} />
        <header>
          <Link href={`/${locale}`} className="site-name">
            {t.chrome.siteName}
          </Link>
          <Suspense fallback={null}>
            <LocaleSwitcher
              current={locale}
              names={t.chrome.localeNames}
              label={t.chrome.switchLocaleLabel}
            />
          </Suspense>
          <SiteNav locale={locale} labels={t.reader.nav} />
          <ThemeToggle
            labels={{
              system: t.chrome.themeSystem,
              light: t.chrome.themeLight,
              dark: t.chrome.themeDark,
            }}
            ariaLabel={t.chrome.themeLabel}
          />
        </header>
        {children}
      </body>
    </html>
  );
}
