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
 * The sign-off: a compact rule with the masthead, its two sections and the
 * year. A publication should end on its name, not on a second masthead — and
 * the footer is also the permanent place to find the sections at phone width,
 * where the bar's navigation moves into the drawer.
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
      <div className="site-footer-inner">
        <div className="site-footer-identity">
          <Link href={home} className="site-footer-brand">
            <BrandMark size={24} />
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
        <div className="site-footer-meta">
          <p>{rights}</p>
          <a className="site-footer-top-link" href="#site-top">
            {chrome.footer.backToTop}
            <ArrowUpIcon width="16" height="16" />
          </a>
        </div>
      </div>
    </footer>
  );
}
