"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "soli-theme";

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

const OPTIONS: { value: ThemePreference; labelKey: keyof ThemeToggleProps["labels"] }[] = [
  { value: "system", labelKey: "system" },
  { value: "light", labelKey: "light" },
  { value: "dark", labelKey: "dark" },
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
  }

  return (
    <div role="group" aria-label={ariaLabel}>
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={preference === option.value}
          onClick={() => select(option.value)}
        >
          {labels[option.labelKey]}
        </button>
      ))}
    </div>
  );
}
