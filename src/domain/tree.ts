/**
 * A tree walked depth-first into the flat list indexes and menus want, with the
 * depth each node sat at so a caller can indent it. The site's trees — the
 * Category tree in the admin editor and the Reader Category index — have the
 * same shape, so they share one walk.
 */
export function flattenTree<T extends { children: readonly T[] }>(
  nodes: readonly T[],
  depth = 0,
): Array<{ node: T; depth: number }> {
  return nodes.flatMap((node) => [
    { node, depth },
    ...flattenTree<T>(node.children, depth + 1),
  ]);
}
