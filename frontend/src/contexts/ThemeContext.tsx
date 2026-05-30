import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';

type Theme = 'light' | 'dark';
const STORAGE_KEY = 'soli-isle-theme';

interface ThemeContextValue { theme: Theme; setTheme: (t: Theme) => void; toggleTheme: () => void; }
const ThemeContext = createContext<ThemeContextValue | null>(null);

function resolveInitial(): { theme: Theme; explicit: boolean } {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return { theme: stored, explicit: true };
  } catch { /* ignore */ }
  const prefersDark = typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-color-scheme: dark)').matches;
  return { theme: prefersDark ? 'dark' : 'light', explicit: false };
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const initial = resolveInitial();
  const [theme, setThemeState] = useState<Theme>(initial.theme);
  const [explicit, setExplicit] = useState(initial.explicit);

  useEffect(() => { document.documentElement.setAttribute('data-theme', theme); }, [theme]);

  useEffect(() => {
    if (explicit) return;
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => setThemeState(e.matches ? 'dark' : 'light');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [explicit]);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t); setExplicit(true);
    try { localStorage.setItem(STORAGE_KEY, t); } catch { /* ignore */ }
  }, []);
  const toggleTheme = useCallback(() => { setTheme(theme === 'dark' ? 'light' : 'dark'); }, [theme, setTheme]);

  return <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
