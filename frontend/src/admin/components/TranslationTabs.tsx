import { useLanguages } from '../../api/languages.js';

interface TranslationTabsProps {
  activeLang: string;
  onSelectLang: (code: string) => void;
}

export function TranslationTabs({ activeLang, onSelectLang }: TranslationTabsProps) {
  const { data: languages } = useLanguages();
  if (!languages || languages.length <= 1) return null;

  return (
    <div className="translation-tabs" role="tablist">
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
