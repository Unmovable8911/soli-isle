"use client";

import { useEffect, useState, type ReactNode } from "react";

import { MoonIcon, SunIcon, SystemIcon } from "./icons";

const STORAGE_KEY = "soli-theme";
/** The same switch is mounted in the bar and in the drawer; one event syncs them. */
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

const OPTIONS: {
  value: ThemePreference;
  labelKey: keyof ThemeToggleProps["labels"];
  icon: ReactNode;
}[] = [
  { value: "system", labelKey: "system", icon: <SystemIcon /> },
  { value: "light", labelKey: "light", icon: <SunIcon /> },
  { value: "dark", labelKey: "dark", icon: <MoonIcon /> },
];

export default function ThemeToggle({ labels, ariaLabel }: ThemeToggleProps) {
  const [preference, setPreference] = useState<ThemePreference | null>(null);
  const [mediaQuery, setMediaQuery] = useState<MediaQueryList | null>(null);

  useEffect(() => {
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
  }, []);

  // The bar's switch and the drawer's switch are two instances of the same
  // control, and only one of them is ever visible. Without this, the hidden one
  // would keep the preference it mounted with and show the wrong segment after
  // a resize.
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

  return (
    <div className="theme-switch" role="group" aria-label={ariaLabel}>
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={preference === option.value}
          aria-label={labels[option.labelKey]}
          title={labels[option.labelKey]}
          onClick={() => select(option.value)}
        >
          {option.icon}
        </button>
      ))}
    </div>
  );
}
