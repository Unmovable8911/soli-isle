import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";

import LocaleSwitcher from "@/components/locale-switcher";
import ThemeToggle from "@/components/theme-toggle";
import { isLocale } from "@/config/site";
import { buildArchivePath, buildCategoryIndexPath, buildSearchPath } from "@/domain/public-paths";
import { messages } from "@/messages";
import { themeInitScript } from "../theme-init";

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
          <nav className="site-nav" aria-label={t.reader.nav.categories}>
            <ul>
              <li>
                <Link href={buildCategoryIndexPath(locale)}>{t.reader.nav.categories}</Link>
              </li>
              <li>
                <Link href={buildArchivePath(locale)}>{t.reader.nav.archive}</Link>
              </li>
              <li>
                <Link href={buildSearchPath({ locale })}>{t.reader.nav.search}</Link>
              </li>
            </ul>
          </nav>
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
