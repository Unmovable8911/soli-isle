"use client";

import { usePathname } from "next/navigation";

import { CategoryTree, type CategoryTreeProps } from "@/components/category-tree";
import { parseCategoryPath } from "@/domain/public-paths";

/** Everything the tree takes except the current position, which this reads. */
type CurrentCategoryTreeProps = Pick<CategoryTreeProps, "locale" | "heading" | "nodes">;

/**
 * The Category tree with its current position marked. A layout cannot see the
 * pathname, so the one thing this component adds is the read a client component
 * in this shell already makes — and it is rendered on the server too, which is
 * why a Reader with JavaScript off still gets the marker in the HTML rather
 * than a tree that only looks right once React arrives.
 */
export function CurrentCategoryTree({ locale, heading, nodes }: CurrentCategoryTreeProps) {
  const pathname = usePathname();
  const currentPath = pathname === null ? null : (parseCategoryPath(pathname)?.categoryPath ?? null);

  return <CategoryTree locale={locale} heading={heading} nodes={nodes} currentPath={currentPath} />;
}
