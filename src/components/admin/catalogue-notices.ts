import { formatMessage } from "@/domain/message-template";
import type { Messages } from "@/messages";

export type CategoryLabels = Messages["admin"]["categories"];
export type TagLabels = Messages["admin"]["tags"];

function countsFrom(body: unknown): Record<string, unknown> {
  return typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
}

function count(values: Record<string, unknown>, key: string): number | null {
  const value = values[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * The refusal a Category delete came back with, said out loud: how many child
 * Categories are still under it, or how many Articles are still filed under it.
 * Anything else is the generic failure — the Author is never told "deleted"
 * when the row is still there.
 */
export function categoryDeleteNotice(labels: CategoryLabels, body: unknown): string {
  const values = countsFrom(body);
  const childCount = count(values, "childCount");
  if (values.error === "has-children" && childCount !== null) {
    return formatMessage(labels.delete.hasChildren, { count: childCount });
  }

  const articleCount = count(values, "articleCount");
  if (values.error === "in-use" && articleCount !== null) {
    return formatMessage(labels.delete.inUse, { count: articleCount });
  }

  return labels.delete.failed;
}

/** The same for a Tag, which refuses while any Article or Post is filed under it. */
export function tagDeleteNotice(labels: TagLabels, body: unknown): string {
  const values = countsFrom(body);
  const articleCount = count(values, "articleCount");
  const postCount = count(values, "postCount");
  if (values.error === "in-use" && articleCount !== null && postCount !== null) {
    return formatMessage(labels.inUse, { articleCount, postCount });
  }

  return labels.deleteFailed;
}
