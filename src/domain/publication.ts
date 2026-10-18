export const PUBLICATION_STATES = ["draft", "published", "archived"] as const;

export type PublicationState = (typeof PUBLICATION_STATES)[number];

/**
 * Derived, never stored. "scheduled" is only a published Article whose Publish
 * Time has not arrived: a draft can never go live on its own, so it stays
 * "draft" no matter what Publish Time it carries.
 */
export type PublicationVisibility = "visible" | "draft" | "scheduled" | "archived";

export interface Publication {
  state: PublicationState;
  /** ISO instant, or null when the article becomes visible as soon as it is published. */
  publishTime: string | null;
}

export function isPublicationState(value: string): value is PublicationState {
  return (PUBLICATION_STATES as readonly string[]).includes(value);
}

export function publicationVisibility(publication: Publication, now: Date): PublicationVisibility {
  if (publication.state === "archived") {
    return "archived";
  }

  if (publication.state === "draft") {
    return "draft";
  }

  const due =
    publication.publishTime === null || Date.parse(publication.publishTime) <= now.getTime();
  return due ? "visible" : "scheduled";
}

export function isVisibleToReader(publication: Publication, now: Date): boolean {
  return publicationVisibility(publication, now) === "visible";
}

/** Archived articles leave lists but keep answering on their own URL. */
export function isReadableByUrl(publication: Publication, now: Date): boolean {
  const visibility = publicationVisibility(publication, now);
  return visibility === "visible" || visibility === "archived";
}

export function isIndexable(publication: Publication, now: Date): boolean {
  return publicationVisibility(publication, now) === "visible";
}
