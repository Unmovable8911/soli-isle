import type { PublicationVisibility } from "./publication";

/**
 * Which lifecycle actions the Author may run from a list row.
 *
 * The offers are read off the derived visibility, never off the stored
 * Publication State, so the buttons and the label beside them can never
 * disagree. Each flag mirrors the precondition the service enforces:
 * `archiveArticle` refuses a work whose stored state is not "published" (i.e.
 * one that is not currently visible or scheduled), and `unarchiveArticle`
 * refuses one that is not archived. Permanent delete is always offered, with
 * a confirmation, and therefore has no flag.
 */
export interface PublicationActions {
  /** Publish now, with a due Publish Time. */
  publishNow: boolean;
  /** Publish with a Publish Time in the future. */
  schedule: boolean;
  archive: boolean;
  unarchive: boolean;
}

export function publicationActions(visibility: PublicationVisibility): PublicationActions {
  // Publishing a work that is already visible would only rewrite the Publish
  // Time of something Readers can already see; it is not an action the Author
  // is asking for. Everything else can be made visible now or given a time.
  const live = visibility === "visible";
  return {
    publishNow: !live,
    schedule: !live,
    archive: visibility === "visible" || visibility === "scheduled",
    unarchive: visibility === "archived",
  };
}
