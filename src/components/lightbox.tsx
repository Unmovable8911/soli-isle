"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";

import { wrapIndex } from "@/domain/carousel";
import type { Messages } from "@/messages";

export { wrapIndex };

export type LightboxLabels = Messages["reader"]["lightbox"];

export interface LightboxImage {
  /** What the page already shows; used when no untouched original is known. */
  src: string;
  /** The uploaded file itself, which is what "original size" means here. */
  original?: string;
  alt: string;
}

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export type TrapTarget = "first" | "last" | null;

/**
 * Where Tab has to go so the ring cannot leave the dialog. The dialog
 * container itself is focusable (`tabIndex={-1}`) so that counted as sitting
 * before the first control.
 */
export function focusTrapTarget(state: {
  shiftKey: boolean;
  activeIsFirst: boolean;
  activeIsLast: boolean;
  activeIsDialog: boolean;
}): TrapTarget {
  if (state.shiftKey && (state.activeIsFirst || state.activeIsDialog)) {
    return "last";
  }
  if (!state.shiftKey && state.activeIsLast) {
    return "first";
  }
  return null;
}

function clamp(index: number, length: number): number {
  if (!Number.isFinite(index) || index < 0) {
    return 0;
  }
  return Math.min(Math.trunc(index), Math.max(length - 1, 0));
}

/**
 * The one lightbox: the Article body uses it through `ImageZoom`, the Feed
 * gallery (ticket 08) mounts it directly with its own images. Mounting it
 * means it is open; unmounting it restores focus to whatever opened it.
 */
export function Lightbox({
  images,
  startIndex = 0,
  labels,
  onClose,
  returnFocusTo = null,
}: {
  images: readonly LightboxImage[];
  startIndex?: number;
  labels: LightboxLabels;
  onClose: () => void;
  /**
   * The control to hand focus back to on close. Defaults to whatever held focus
   * when the dialog mounted — but a pointer click does not always focus a
   * button (Safari), so a caller that knows its trigger can say so.
   */
  returnFocusTo?: HTMLElement | null;
}) {
  const [index, setIndex] = useState(() => clamp(startIndex, images.length));
  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<Element | null>(null);

  useEffect(() => {
    restoreRef.current = returnFocusTo ?? document.activeElement;
    dialogRef.current?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
      const previous = restoreRef.current;
      if (previous instanceof HTMLElement && previous.isConnected) {
        previous.focus();
      }
    };
  }, [returnFocusTo]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      // A modified arrow is a browser shortcut, not a request for the next picture.
      if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (images.length < 2) {
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setIndex((current) => wrapIndex(current, -1, images.length));
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        setIndex((current) => wrapIndex(current, 1, images.length));
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [images.length, onClose]);

  if (images.length === 0) {
    return null;
  }

  const current = images[clamp(index, images.length)];
  if (current === undefined) {
    return null;
  }

  function trapFocus(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab") {
      return;
    }
    const dialog = dialogRef.current;
    if (dialog === null) {
      return;
    }
    const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (element) => !element.hasAttribute("disabled"),
    );
    if (focusable.length === 0) {
      event.preventDefault();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    const target = focusTrapTarget({
      shiftKey: event.shiftKey,
      activeIsFirst: active === first,
      activeIsLast: active === last,
      activeIsDialog: active === dialog,
    });
    if (target === null) {
      return;
    }
    event.preventDefault();
    (target === "first" ? first : last)?.focus();
  }

  const position = `${index + 1} / ${images.length}`;

  return (
    <div
      className="lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={labels.dialog}
      tabIndex={-1}
      ref={dialogRef}
      onKeyDown={trapFocus}
    >
      <button type="button" className="lightbox-close" aria-label={labels.close} onClick={onClose}>
        ×
      </button>
      <button
        type="button"
        className="lightbox-previous"
        aria-label={labels.previous}
        onClick={() => setIndex((currentIndex) => wrapIndex(currentIndex, -1, images.length))}
        disabled={images.length < 2}
      >
        ‹
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element -- the address comes from the Asset store, not the image optimizer */}
      <img className="lightbox-image" src={current.original ?? current.src} alt={current.alt} />
      <button
        type="button"
        className="lightbox-next"
        aria-label={labels.next}
        onClick={() => setIndex((currentIndex) => wrapIndex(currentIndex, 1, images.length))}
        disabled={images.length < 2}
      >
        ›
      </button>
      <p className="lightbox-position" aria-live="polite">
        {position}
      </p>
    </div>
  );
}

function imagesIn(container: HTMLElement): LightboxImage[] {
  return Array.from(container.querySelectorAll("img")).map((element) => ({
    src: element.getAttribute("src") ?? "",
    original: element.dataset.original,
    alt: element.getAttribute("alt") ?? "",
  }));
}

/**
 * Makes the rendered Article body zoomable without a second renderer: the body
 * HTML stays server-produced and this only listens for a click or Enter on an
 * `<img>` inside it.
 */
export function ImageZoom({
  labels,
  children,
}: {
  labels: LightboxLabels;
  children: ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [opened, setOpened] = useState<{ images: LightboxImage[]; index: number } | null>(null);

  const open = useCallback((image: HTMLImageElement) => {
    const container = containerRef.current;
    if (container === null) {
      return;
    }
    const elements = Array.from(container.querySelectorAll("img"));
    setOpened({
      images: imagesIn(container),
      index: Math.max(elements.indexOf(image), 0),
    });
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (container === null) {
      return;
    }
    for (const image of container.querySelectorAll("img")) {
      image.tabIndex = 0;
      image.setAttribute("role", "button");
      image.setAttribute("aria-haspopup", "dialog");
      // A picture with no authored description still needs a name for the
      // control it became; it is named after the viewer it opens, not after the
      // uploaded file, which is metadata and not a description of the picture.
      if ((image.getAttribute("alt") ?? "").trim() === "") {
        image.setAttribute("aria-label", labels.dialog);
      }
    }
  }, [children, labels.dialog]);

  function handleClick(event: ReactMouseEvent<HTMLDivElement>) {
    if (event.target instanceof HTMLImageElement) {
      open(event.target);
    }
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (
      event.target instanceof HTMLImageElement &&
      (event.key === "Enter" || event.key === " ")
    ) {
      event.preventDefault();
      open(event.target);
    }
  }

  return (
    <div
      className="zoomable"
      ref={containerRef}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      {children}
      {opened !== null && (
        <Lightbox
          images={opened.images}
          startIndex={opened.index}
          labels={labels}
          onClose={() => setOpened(null)}
        />
      )}
    </div>
  );
}
