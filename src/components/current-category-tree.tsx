"use client";

import { usePathname } from "next/navigation";

import { CategoryTree } from "@/components/category-tree";
import type { Locale } from "@/config/site";
import { parseCategoryPath } from "@/domain/public-paths";
import type { ReaderCategoryNode } from "@/services/reading";

/**
 * The Category tree with its current position marked. A layout cannot see the
 * pathname, so the one thing this component adds is the read a client component
 * in this shell already makes — and it is rendered on the server too, which is
 * why a Reader with JavaScript off still gets the marker in the HTML rather
 * than a tree that only looks right once React arrives.
 */
export function CurrentCategoryTree({
  locale,
  heading,
  nodes,
}: {
  locale: Locale;
  heading: string;
  nodes: ReaderCategoryNode[];
}) {
  const pathname = usePathname();
  const currentPath = pathname === null ? null : (parseCategoryPath(pathname)?.categoryPath ?? null);

  return <CategoryTree locale={locale} heading={heading} nodes={nodes} currentPath={currentPath} />;
}
