import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { useLanguages } from '../api/languages.js';

interface LanguageContextValue {
  lang: string;
  setLang: (code: string) => void;
  availableLanguages: { code: string; name: string }[];
}

const LanguageContext = createContext<LanguageContextValue | null>(null);
const STORAGE_KEY = 'soli-isle-lang';

export function LanguageProvider({ children }: { children: ReactNode }) {
  const { data: languages } = useLanguages();
  const [lang, setLangState] = useState<string>('');

  useEffect(() => {
    if (!languages || languages.length === 0) return;

    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && languages.some(l => l.code === stored)) {
      setLangState(stored);
      return;
    }

    const browserLang = navigator.language.slice(0, 2);
    if (languages.some(l => l.code === browserLang)) {
      setLangState(browserLang);
      return;
    }

    const defaultLang = languages.find(l => l.is_default === 1);
    setLangState(defaultLang?.code ?? languages[0]!.code);
  }, [languages]);

  const setLang = useCallback((code: string) => {
    localStorage.setItem(STORAGE_KEY, code);
    setLangState(code);
  }, []);

  const availableLanguages = (languages ?? []).map(l => ({ code: l.code, name: l.name }));

  return (
    <LanguageContext.Provider value={{ lang, setLang, availableLanguages }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}
