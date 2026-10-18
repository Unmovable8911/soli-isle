import Link from "next/link";

import type { Locale } from "@/config/site";
import { buildCategoryPath } from "@/domain/public-paths";
import type { ReaderCategoryNode } from "@/services/reading";

export interface CategoryTreeProps {
  locale: Locale;
  heading: string;
  nodes: ReaderCategoryNode[];
  /**
   * The Category the current page is showing, or null anywhere else. It is
   * passed in rather than read from a hook so this stays a plain component: the
   * level a name sits at is the nesting, and the marker is one attribute.
   */
  currentPath: string | null;
}

export function CategoryTree({ locale, heading, nodes, currentPath }: CategoryTreeProps) {
  return (
    <div className="site-categories">
      <h2 className="site-categories-heading">{heading}</h2>
      <CategoryLevel locale={locale} nodes={nodes} currentPath={currentPath} />
    </div>
  );
}

function CategoryLevel({
  locale,
  nodes,
  currentPath,
}: {
  locale: Locale;
  nodes: ReaderCategoryNode[];
  currentPath: string | null;
}) {
  return (
    <ul className="site-tree">
      {nodes.map((node) => (
        <li key={node.id} className="site-tree-node">
          <Link
            href={buildCategoryPath({ locale, categoryPath: node.path })}
            aria-current={node.path === currentPath ? "page" : undefined}
          >
            {node.name}
          </Link>
          {node.children.length === 0 ? null : (
            <CategoryLevel locale={locale} nodes={node.children} currentPath={currentPath} />
          )}
        </li>
      ))}
    </ul>
  );
}
