/** A Category's `path` is its Slug chain: "notes/tools/editor". */
export function categoryPathSegments(path: string): string[] {
  return path.split("/").filter((segment) => segment.length > 0);
}

export interface CategoryCrumb {
  /** The accumulated path up to this level, usable as a Category URL segment. */
  path: string;
  slug: string;
}

/** Root first, requested Category last: one breadcrumb per level. */
export function categoryAncestorPaths(path: string): CategoryCrumb[] {
  const segments = categoryPathSegments(path);
  const crumbs: CategoryCrumb[] = [];
  let accumulated = "";

  for (const slug of segments) {
    accumulated = accumulated.length === 0 ? slug : `${accumulated}/${slug}`;
    crumbs.push({ path: accumulated, slug });
  }

  return crumbs;
}

/** A Category lists its own Articles plus every descendant's, but never a sibling's. */
export function isWithinCategoryPath(candidate: string, ancestor: string): boolean {
  if (candidate === ancestor) {
    return true;
  }
  if (ancestor.length === 0) {
    return true;
  }
  return candidate.startsWith(`${ancestor}/`);
}
