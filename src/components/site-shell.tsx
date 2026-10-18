import Link from "next/link";
import { Suspense, type ReactNode } from "react";

import { CurrentCategoryTree } from "@/components/current-category-tree";
import LocaleSwitcher from "@/components/locale-switcher";
import { SiteNav } from "@/components/site-nav";
import { SkipLink } from "@/components/skip-link";
import ThemeToggle from "@/components/theme-toggle";
import type { Locale } from "@/config/site";
import { buildHomePath } from "@/domain/public-paths";
import type { Messages } from "@/messages";
import type { ReaderCategoryNode } from "@/services/reading";

export interface SiteShellProps {
  locale: Locale;
  chrome: Messages["chrome"];
  nav: Messages["reader"]["nav"];
  search: Messages["reader"]["search"];
  categoriesHeading: string;
  categories: ReaderCategoryNode[];
  children: ReactNode;
}

/**
 * The public site's frame: a 64px sticky top bar whose only wide-screen content
 * is the search form, a 256px sticky rail, and — below 64rem — a native
 * \`<details>\` drawer carrying what the rail carries. Both copies are in the DOM
 * and CSS shows one of them, so the shell needs no client state and the menu
 * opens, closes and takes focus with JavaScript off.
 *
 * The rail sections are one element rendered twice for that reason, not two
 * implementations that could drift apart.
 */
export function SiteShell({
  locale,
  chrome,
  nav,
  search,
  categoriesHeading,
  categories,
  children,
}: SiteShellProps) {
  const home = buildHomePath(locale);
  const sections = (
    <div className="site-sections">
      <SiteNav locale={locale} labels={nav} />
      <CurrentCategoryTree locale={locale} heading={categoriesHeading} nodes={categories} />
      <div className="site-rail-controls">
        <Suspense fallback={null}>
          <LocaleSwitcher
            current={locale}
            names={chrome.localeNames}
            label={chrome.switchLocaleLabel}
          />
        </Suspense>
        <ThemeToggle
          labels={{
            system: chrome.themeSystem,
            light: chrome.themeLight,
            dark: chrome.themeDark,
          }}
          ariaLabel={chrome.themeLabel}
        />
      </div>
    </div>
  );

  return (
    <>
      <SkipLink label={chrome.skipToContent} />
      <header className="site-topbar">
        <Link href={home} className="site-name">
          {chrome.siteName}
        </Link>
        <form
          className="site-search"
          action={`/${locale}/search`}
          method="get"
          role="search"
          aria-label={chrome.searchLabel}
        >
          <input
            type="search"
            name="q"
            aria-label={chrome.searchLabel}
            placeholder={search.placeholder}
          />
          <button type="submit">{search.submit}</button>
        </form>
        <details className="site-menu">
          <summary>{chrome.menuLabel}</summary>
          <div className="site-menu-panel">{sections}</div>
        </details>
      </header>
      <div className="site-shell">
        <aside className="site-rail" aria-label={chrome.railLabel}>
          <Link href={home} className="site-rail-wordmark">
            {chrome.siteName}
          </Link>
          {sections}
        </aside>
        <div className="site-content">{children}</div>
      </div>
    </>
  );
}
