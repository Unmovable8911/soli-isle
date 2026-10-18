import Link from "next/link";
import { Suspense, type ReactNode } from "react";

import { BrandMark, MenuIcon, SearchIcon } from "@/components/icons";
import { CurrentSiteNav } from "@/components/current-site-nav";
import LocaleSwitcher from "@/components/locale-switcher";
import { SiteFooter } from "@/components/site-footer";
import { SiteSearch } from "@/components/site-search";
import { SkipLink } from "@/components/skip-link";
import ThemeToggle from "@/components/theme-toggle";
import type { Locale } from "@/config/site";
import { buildHomePath, buildSearchPath } from "@/domain/public-paths";
import type { Messages } from "@/messages";

export interface SiteShellProps {
  locale: Locale;
  chrome: Messages["chrome"];
  nav: Messages["reader"]["nav"];
  search: Messages["reader"]["search"];
  children: ReactNode;
}

/**
 * The public site's frame: a 64px sticky top bar carrying the wordmark, the
 * search field and the theme switch; a 256px sticky rail under it carrying the
 * sections; a native `<details>` drawer below 64rem carrying the same things;
 * and the sign-off footer every page closes on.
 *
 * The rail's sections are one element rendered twice — once in the rail, once
 * in the drawer — so the shell needs no client state to open the menu, and the
 * two copies cannot drift apart. CSS shows exactly one of them at any width.
 */
export function SiteShell({ locale, chrome, nav, search, children }: SiteShellProps) {
  const home = buildHomePath(locale);
  const searchField = (
    <SiteSearch
      locale={locale}
      id="site-search-bar"
      label={chrome.searchLabel}
      placeholder={search.placeholder}
      submit={search.submit}
    />
  );
  const drawerSearchField = (
    <SiteSearch
      locale={locale}
      id="site-search-drawer"
      label={chrome.searchLabel}
      placeholder={search.placeholder}
      submit={search.submit}
      withLabel
    />
  );
  const sections = (
    <div className="site-sections">
      <div>
        <p className="site-rail-heading">{chrome.browseLabel}</p>
        <CurrentSiteNav locale={locale} labels={nav} />
      </div>
    </div>
  );
  const themeToggle = (
    <ThemeToggle
      labels={{
        system: chrome.themeSystem,
        light: chrome.themeLight,
        dark: chrome.themeDark,
      }}
      ariaLabel={chrome.themeLabel}
    />
  );

  return (
    <>
      <SkipLink label={chrome.skipToContent} />
      <header className="site-topbar" id="site-top">
        <Link href={home} className="site-brand">
          <BrandMark className="site-brand-mark" />
          <span className="site-name">{chrome.siteName}</span>
        </Link>
        {searchField}
        <div className="site-topbar-actions">
          {themeToggle}
          {/* The bar's field is hidden below 64rem, so the same journey gets a
              one-tap entry to the search page instead of only living in the
              drawer. */}
          <Link
            href={buildSearchPath({ locale })}
            className="site-search-link"
            aria-label={chrome.searchLabel}
          >
            <SearchIcon />
          </Link>
          <details className="site-menu">
            <summary>
              <MenuIcon />
              <span>{chrome.menuLabel}</span>
            </summary>
            <div className="site-menu-panel">
              {drawerSearchField}
              {sections}
              <div className="site-rail-foot">
                <Suspense fallback={null}>
                  <LocaleSwitcher
                    current={locale}
                    names={chrome.localeNames}
                    label={chrome.switchLocaleLabel}
                  />
                </Suspense>
                {themeToggle}
              </div>
            </div>
          </details>
        </div>
      </header>
      <div className="site-shell">
        <aside className="site-rail" aria-label={chrome.railLabel}>
          {sections}
          <div className="site-rail-foot">
            <p className="site-rail-note">{chrome.footer.tagline}</p>
            <Suspense fallback={null}>
              <LocaleSwitcher
                current={locale}
                names={chrome.localeNames}
                label={chrome.switchLocaleLabel}
              />
            </Suspense>
          </div>
        </aside>
        <div className="site-content">
          {children}
          <SiteFooter locale={locale} chrome={chrome} nav={nav} />
        </div>
      </div>
    </>
  );
}
