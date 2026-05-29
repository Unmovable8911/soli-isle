import { type KeyboardEvent } from 'react';
import { useLanguages } from '../../api/languages.js';

interface TranslationTabsProps {
  activeLang: string;
  onSelectLang: (code: string) => void;
}

export function TranslationTabs({ activeLang, onSelectLang }: TranslationTabsProps) {
  const { data: languages } = useLanguages();
  if (!languages || languages.length <= 1) return null;

  const codes = languages.map(l => l.code);

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const idx = codes.indexOf(activeLang);
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      onSelectLang(codes[(idx + 1) % codes.length]!);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      onSelectLang(codes[(idx - 1 + codes.length) % codes.length]!);
    } else if (e.key === 'Home') {
      e.preventDefault();
      onSelectLang(codes[0]!);
    } else if (e.key === 'End') {
      e.preventDefault();
      onSelectLang(codes[codes.length - 1]!);
    }
  }

  return (
    <div className="translation-tabs" role="tablist" onKeyDown={handleKeyDown}>
      {languages.map(lang => (
        <button key={lang.id} type="button" role="tab" aria-selected={activeLang === lang.code}
          className={activeLang === lang.code ? 'active' : ''}
          onClick={() => onSelectLang(lang.code)}>
          {lang.name}
        </button>
      ))}
    </div>
  );
}
