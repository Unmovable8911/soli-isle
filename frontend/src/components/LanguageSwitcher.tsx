import { useLanguage } from '../contexts/LanguageContext.js';

export function LanguageSwitcher() {
  const { lang, isReady, setLang, availableLanguages } = useLanguage();
  if (!isReady || availableLanguages.length <= 1) return null;

  return (
    <select value={lang} onChange={(e) => setLang(e.target.value)} aria-label="Select language">
      {availableLanguages.map((l) => (
        <option key={l.code} value={l.code}>{l.name}</option>
      ))}
    </select>
  );
}
