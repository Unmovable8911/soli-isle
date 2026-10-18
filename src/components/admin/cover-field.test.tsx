import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { messages } from "@/messages";

import { CoverField, coverPreviewAddress } from "./cover-field";

const labels = messages.en.admin.articles.meta;
const COVER_ID = "3f8a1c2e-1111-4a2b-9c3d-4e5f6a7b8c9d";

function render(coverAssetId: string | null): string {
  return renderToStaticMarkup(
    <CoverField
      coverAssetId={coverAssetId}
      labels={labels}
      onChoose={() => undefined}
      onRemove={() => undefined}
    />,
  );
}

describe("the cover control", () => {
  it("shows the no-cover state as a legal state, with only a control to choose one", () => {
    const html = render(null);

    expect(html).toContain(labels.noCover);
    expect(html).not.toContain("<img");
    expect(html).toContain(`>${labels.chooseCover}</button>`);
    expect(html).not.toContain(`>${labels.removeCover}</button>`);
  });

  it("previews the chosen image from the display derivation and offers to change or remove it", () => {
    const html = render(COVER_ID);

    expect(html).toContain(`src="/media/${COVER_ID}/display.webp"`);
    // The cover is decoration on a card and a picture in its own right; the
    // Asset carries no authored description, so it is presentational here.
    expect(html).toContain('alt=""');
    expect(html).toContain(`>${labels.changeCover}</button>`);
    expect(html).toContain(`>${labels.removeCover}</button>`);
    expect(html).not.toContain(labels.chooseCover);
  });

  it("is a labelled group, so the two buttons are not loose controls", () => {
    expect(render(null)).toContain(`aria-label="${labels.cover}"`);
  });
});

describe("the cover preview address", () => {
  it("reads the display derivation of the chosen image", () => {
    expect(coverPreviewAddress(COVER_ID)).toBe(`/media/${COVER_ID}/display.webp`);
  });

  it("has nothing to preview without a cover, or with something that is not an id", () => {
    expect(coverPreviewAddress(null)).toBeNull();
    expect(coverPreviewAddress("not-a-uuid")).toBeNull();
  });
});
