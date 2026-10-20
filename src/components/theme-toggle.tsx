"use client";

import { useEffect, useLayoutEffect, useState, type ReactNode } from "react";

import { MoonIcon, SunIcon, SystemIcon } from "./icons";

const STORAGE_KEY = "soli-theme";

// Layout effects are client-only; on the server this falls back to useEffect so
// rendering a client component during SSR does not warn.
const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

/** The same button is mounted in the bar and in the drawer; one event syncs them. */
const CHANGE_EVENT = "soli-theme-change";

type ThemePreference = "system" | "light" | "dark";
type ResolvedTheme = "light" | "dark";

function systemTheme(): ResolvedTheme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme: ResolvedTheme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

interface ThemeToggleProps {
  labels: { system: string; light: string; dark: string };
  ariaLabel: string;
}

const OPTIONS: Record<
  ThemePreference,
  { labelKey: keyof ThemeToggleProps["labels"]; icon: ReactNode }
> = {
  system: { labelKey: "system", icon: <SystemIcon /> },
  light: { labelKey: "light", icon: <SunIcon /> },
  dark: { labelKey: "dark", icon: <MoonIcon /> },
};

/** One tap moves the preference on: system → light → dark → system. */
const NEXT: Record<ThemePreference, ThemePreference> = {
  system: "light",
  light: "dark",
  dark: "system",
};

export default function ThemeToggle({ labels, ariaLabel }: ThemeToggleProps) {
  const [preference, setPreference] = useState<ThemePreference | null>(null);
  const [mediaQuery, setMediaQuery] = useState<MediaQueryList | null>(null);

  useIsomorphicLayoutEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    setMediaQuery(media);

    let stored: ThemePreference = "system";
    try {
      const value = localStorage.getItem(STORAGE_KEY);
      if (value === "light" || value === "dark") {
        stored = value;
      }
    } catch {
      // localStorage access can throw in private browsing.
    }
    setPreference(stored);
    // A client navigation can replace the server-rendered <html> attributes
    // with the ones the new layout sent, which do not carry the stored theme.
    // The blocking theme script only runs on document loads, so restore the
    // preference here after a locale switch as well.
    applyTheme(stored === "system" ? systemTheme() : stored);
  }, []);

  // The bar's button and the drawer's button are two instances of the same
  // control, and only one of them is ever visible. Without this, the hidden one
  // would keep the preference it mounted with and show the wrong icon after a
  // resize.
  useEffect(() => {
    function handleChange(event: Event) {
      const detail = (event as CustomEvent<string>).detail;
      if (detail === "system" || detail === "light" || detail === "dark") {
        setPreference(detail);
      }
    }
    window.addEventListener(CHANGE_EVENT, handleChange);
    return () => window.removeEventListener(CHANGE_EVENT, handleChange);
  }, []);

  useEffect(() => {
    if (mediaQuery === null) {
      return;
    }
    function handleSystemChange(event: MediaQueryListEvent) {
      setPreference((current) => {
        if (current === "system") {
          applyTheme(event.matches ? "dark" : "light");
        }
        return current;
      });
    }
    mediaQuery.addEventListener("change", handleSystemChange);
    return () => mediaQuery.removeEventListener("change", handleSystemChange);
  }, [mediaQuery]);

  function select(value: ThemePreference) {
    try {
      if (value === "system") {
        localStorage.removeItem(STORAGE_KEY);
      } else {
        localStorage.setItem(STORAGE_KEY, value);
      }
    } catch {
      // localStorage access can throw in private browsing.
    }
    setPreference(value);
    applyTheme(value === "system" ? systemTheme() : value);
    window.dispatchEvent(new CustomEvent<string>(CHANGE_EVENT, { detail: value }));
  }

  const current = preference ?? "system";
  const option = OPTIONS[current];
  const label = `${ariaLabel}: ${labels[option.labelKey]}`;

  return (
    <button
      className="theme-toggle"
      type="button"
      aria-label={label}
      title={label}
      data-theme-preference={current}
      onClick={() => select(NEXT[current])}
    >
      {option.icon}
    </button>
  );
}
