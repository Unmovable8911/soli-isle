import { describe, expect, it } from "vitest";

import { publicationActions } from "./publication-actions";

describe("publication actions", () => {
  it("offers publish and schedule to a draft, and no archive", () => {
    expect(publicationActions("draft")).toEqual({
      publishNow: true,
      schedule: true,
      archive: false,
      unarchive: false,
    });
  });

  it("offers only archive to a visible work, because publishing it again is not an action", () => {
    expect(publicationActions("visible")).toEqual({
      publishNow: false,
      schedule: false,
      archive: true,
      unarchive: false,
    });
  });

  it("lets a scheduled work go live now, change its time, or come down", () => {
    expect(publicationActions("scheduled")).toEqual({
      publishNow: true,
      schedule: true,
      archive: true,
      unarchive: false,
    });
  });

  it("offers unarchive plus a fresh publish to an archived work", () => {
    expect(publicationActions("archived")).toEqual({
      publishNow: true,
      schedule: true,
      archive: false,
      unarchive: true,
    });
  });

  it("mirrors the service guard: archive is exactly the published-but-not-archived case", () => {
    // `archiveArticle` refuses anything whose stored state is not "published",
    // `unarchiveArticle` refuses anything not "archived". The offers must not
    // promise a call the service would reject.
    for (const visibility of ["draft", "visible", "scheduled", "archived"] as const) {
      const offers = publicationActions(visibility);
      expect(offers.archive).toBe(visibility === "visible" || visibility === "scheduled");
      expect(offers.unarchive).toBe(visibility === "archived");
    }
  });
});
