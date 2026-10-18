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
 * sections, the search field and the language and theme controls; a native
 * `<details>` drawer below 64rem carrying the same sections and controls; and
 * the sign-off footer every page closes on.
 *
 * The sections and the two controls are one element rendered twice — once in
 * the bar, once in the drawer — so the shell needs no client state to open the
 * menu, and the two copies cannot drift apart. CSS shows exactly one of them at
 * any width. The reading column is capped and centred rather than stretched
 * across a wide desktop.
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
  const navLinks = <CurrentSiteNav locale={locale} labels={nav} />;
  const localeSwitcher = (
    <Suspense fallback={null}>
      <LocaleSwitcher
        current={locale}
        names={chrome.localeNames}
        label={chrome.switchLocaleLabel}
      />
    </Suspense>
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
        <div className="site-topbar-nav">{navLinks}</div>
        {searchField}
        <div className="site-topbar-actions">
          <div className="site-topbar-controls">
            {localeSwitcher}
            {themeToggle}
          </div>
          {/* The bar's field is hidden below 64rem, so the search page keeps a
              one-tap entry there; the drawer still carries the real field. */}
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
              <div className="site-menu-nav">
                <p className="site-menu-heading">{chrome.browseLabel}</p>
                {navLinks}
              </div>
              <div className="site-menu-controls">
                {localeSwitcher}
                {themeToggle}
              </div>
            </div>
          </details>
        </div>
      </header>
      <div className="site-shell">
        <div className="site-content">
          {children}
          <SiteFooter locale={locale} chrome={chrome} nav={nav} />
        </div>
      </div>
    </>
  );
}
