import { useLanguage } from '../contexts/LanguageContext.js';

/**
 * Shown on a content item whose translation in the active language is missing
 * and is therefore displayed in the default (fallback) language. Renders
 * nothing when the item is already in the active language.
 */
export function FallbackBadge({ lang }: { lang?: string }) {
  const { lang: active, availableLanguages, t } = useLanguage();
  if (!lang || lang === active) return null;

  const name = availableLanguages.find(l => l.code === lang)?.name ?? lang.toUpperCase();
  return (
    <span className="badge" title={t('fallback_notice', 'Not available in the selected language')}>
      {t('shown_in', 'Shown in')} {name}
    </span>
  );
}
