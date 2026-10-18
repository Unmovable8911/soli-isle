import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Lightbox, focusTrapTarget, wrapIndex } from "./lightbox";

const IMAGES = [
  { src: "/media/a/display.webp", original: "/media/a/original.png", alt: "diagram" },
  { src: "/media/b/display.webp", alt: "photo" },
];

const LABELS = {
  dialog: "Image viewer",
  close: "Close",
  previous: "Previous image",
  next: "Next image",
};

function render(startIndex = 0): string {
  return renderToStaticMarkup(
    <Lightbox images={IMAGES} startIndex={startIndex} labels={LABELS} onClose={() => {}} />,
  );
}

describe("lightbox keyboard rules", () => {
  it("wraps at both ends so the arrow keys always move somewhere", () => {
    expect(wrapIndex(0, 1, 3)).toBe(1);
    expect(wrapIndex(2, 1, 3)).toBe(0);
    expect(wrapIndex(0, -1, 3)).toBe(2);
    expect(wrapIndex(0, -1, 1)).toBe(0);
  });

  it("keeps Tab inside the dialog: forward from the last control, back from the first", () => {
    expect(focusTrapTarget({ shiftKey: false, activeIsFirst: false, activeIsLast: true, activeIsDialog: false }))
      .toBe("first");
    expect(focusTrapTarget({ shiftKey: true, activeIsFirst: true, activeIsLast: false, activeIsDialog: false }))
      .toBe("last");
    // Focus sitting on the dialog container itself counts as "before the first control".
    expect(focusTrapTarget({ shiftKey: true, activeIsFirst: false, activeIsLast: false, activeIsDialog: true }))
      .toBe("last");
  });

  it("leaves ordinary tabbing alone", () => {
    expect(focusTrapTarget({ shiftKey: false, activeIsFirst: false, activeIsLast: false, activeIsDialog: false }))
      .toBeNull();
    expect(focusTrapTarget({ shiftKey: true, activeIsFirst: false, activeIsLast: false, activeIsDialog: false }))
      .toBeNull();
  });
});

describe("lightbox", () => {
  it("is a modal dialog labelled for assistive technology", () => {
    const html = render();

    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('aria-label="Image viewer"');
  });

  it("shows the untouched original at full size, not the derived variant", () => {
    expect(render()).toContain('src="/media/a/original.png"');
  });

  it("falls back to the given source when a picture has no stored original", () => {
    expect(render(1)).toContain('src="/media/b/display.webp"');
  });

  it("offers close and arrow navigation", () => {
    const html = render();

    expect(html).toContain('aria-label="Close"');
    expect(html).toContain('aria-label="Previous image"');
    expect(html).toContain('aria-label="Next image"');
    expect(html).toContain("1 / 2");
  });

  it("reports the position of the picture on view", () => {
    expect(render(1)).toContain("2 / 2");
  });

  it("renders nothing when there is no picture to show", () => {
    expect(
      renderToStaticMarkup(<Lightbox images={[]} labels={LABELS} onClose={() => {}} />),
    ).toBe("");
  });
});
