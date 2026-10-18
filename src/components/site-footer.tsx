import Link from "next/link";

import type { Locale } from "@/config/site";
import {
  buildArchivePath,
  buildFeedPath,
  buildHomePath,
} from "@/domain/public-paths";
import type { Messages } from "@/messages";

import { ArrowUpIcon, BrandMark } from "./icons";

/**
 * The sign-off: the site's own name, one line about it, its two sections and
 * the year. A publication should end on its masthead, not on the last pixel of
 * the last paragraph — and the footer is also the only place the Reader can
 * always find every section at phone width, where the rail is a drawer.
 */
export function SiteFooter({
  locale,
  chrome,
  nav,
}: {
  locale: Locale;
  chrome: Messages["chrome"];
  nav: Messages["reader"]["nav"];
}) {
  const home = buildHomePath(locale);
  const items = [
    { href: buildArchivePath(locale), label: nav.archive },
    { href: buildFeedPath({ locale }), label: nav.feed },
  ];
  const rights = chrome.footer.rights.replaceAll("{year}", String(new Date().getFullYear()));

  return (
    <footer className="site-footer">
      <div className="site-footer-top">
        <Link href={home} className="site-footer-brand">
          <BrandMark size={30} />
          <span>{chrome.siteName}</span>
        </Link>
        <p className="site-footer-note">{chrome.footer.tagline}</p>
      </div>
      <nav className="site-footer-nav" aria-label={chrome.footer.navLabel}>
        <ul>
          {items.map((item) => (
            <li key={item.href}>
              <Link href={item.href}>{item.label}</Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className="site-footer-bottom">
        <p>{rights}</p>
        <a className="site-footer-top-link" href="#site-top">
          {chrome.footer.backToTop}
          <ArrowUpIcon width="16" height="16" />
        </a>
      </div>
    </footer>
  );
}
