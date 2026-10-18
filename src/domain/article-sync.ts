/**
 * The one decision the editor is not allowed to guess at: may a local copy be
 * pushed to the server, is there nothing to push, or would pushing overwrite a
 * newer server copy?
 *
 * Pure by construction — the React layer renders the outcome instead of
 * re-deriving it, and the sync engine asks this before every write.
 */

export interface ArticleEditContent {
  title: string;
  summary: string;
  bodyJson: string;
}

export interface LocalArticleEdit extends ArticleEditContent {
  /** The server version this local copy was derived from. */
  baseVersion: number;
}

export interface ServerArticleState extends ArticleEditContent {
  /** Monotonic counter bumped by every write to the translation row. */
  version: number;
}

export type EditReconciliation = "in-sync" | "push" | "conflict";

function canonicalJson(bodyJson: string): string | null {
  try {
    return JSON.stringify(JSON.parse(bodyJson));
  } catch {
    return null;
  }
}

/**
 * Titles and summaries are compared literally: the save path trims a title, so
 * treating `"Draft "` as equal to `"Draft"` would drop a byte the Author typed
 * without telling them. A document is compared structurally, because a
 * re-serialised document with the same nodes is the same content.
 */
function sameContent(left: ArticleEditContent, right: ArticleEditContent): boolean {
  if (left.title !== right.title || left.summary !== right.summary) {
    return false;
  }
  if (left.bodyJson === right.bodyJson) {
    return true;
  }
  const leftJson = canonicalJson(left.bodyJson);
  return leftJson !== null && leftJson === canonicalJson(right.bodyJson);
}

export function reconcileArticleEdit(
  local: LocalArticleEdit,
  server: ServerArticleState,
): EditReconciliation {
  // Equal content means there is nothing to lose by dropping the local copy,
  // whatever the versions say — the server already holds exactly these bytes.
  if (sameContent(local, server)) {
    return "in-sync";
  }
  return local.baseVersion === server.version ? "push" : "conflict";
}
