"use client";

import { usePathname } from "next/navigation";

import { SiteNav, type SiteNavLabels } from "@/components/site-nav";
import type { Locale } from "@/config/site";

/**
 * The section navigation with its current address marked. A layout cannot see
 * the pathname, and the shell already renders client components that do, so
 * this adds no state the page did not have — and the server-rendered HTML
 * still carries the marker with JavaScript off.
 */
export function CurrentSiteNav({ locale, labels }: { locale: Locale; labels: SiteNavLabels }) {
  const pathname = usePathname();
  return <SiteNav locale={locale} labels={labels} currentPath={pathname} />;
}
