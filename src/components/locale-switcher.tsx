"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import { siteConfig, type Locale } from "@/config/site";
import { swapLocalePathname } from "@/domain/locale";

const LOCALE_COOKIE = "soli-locale";
const LOCALE_COOKIE_MAX_AGE_SECONDS = 31536000;

interface LocaleSwitcherProps {
  current: Locale;
  names: Record<Locale, string>;
  label: string;
}

export default function LocaleSwitcher({ current, names, label }: LocaleSwitcherProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();

  function handleClick(target: Locale) {
    document.cookie = `${LOCALE_COOKIE}=${target}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE_SECONDS}; samesite=lax`;
  }

  return (
    <nav className="site-locale" aria-label={label}>
      <ul>
        {siteConfig.locales.map((locale) => {
          const href = `${swapLocalePathname(pathname, locale)}${query ? `?${query}` : ""}`;
          return (
            <li key={locale}>
              <Link
                href={href}
                aria-current={locale === current ? "page" : undefined}
                onClick={() => handleClick(locale)}
              >
                {names[locale]}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
