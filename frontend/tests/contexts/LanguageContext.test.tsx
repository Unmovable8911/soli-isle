import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../src/api/languages.js', () => ({
  useLanguages: () => ({ data: [
    { id: '1', code: 'en', name: 'English', is_default: 1 },
    { id: '2', code: 'zh', name: '中文', is_default: 0 },
  ] }),
}));

// Simulate the UI-strings map the API would return for the active language.
vi.mock('../../src/api/ui-strings.js', () => ({
  useUIStrings: () => ({ data: { 'nav.home': 'Home-translated' } }),
}));

import { LanguageProvider, useLanguage } from '../../src/contexts/LanguageContext.js';

function TestConsumer() {
  const { t } = useLanguage();
  return (
    <div>
      <span data-testid="present">{t('nav.home', 'Home')}</span>
      <span data-testid="missing">{t('nav.articles', 'Articles')}</span>
    </div>
  );
}

describe('LanguageContext t()', () => {
  it('returns the translated value when the key exists', () => {
    render(<LanguageProvider><TestConsumer /></LanguageProvider>);
    expect(screen.getByTestId('present')).toHaveTextContent('Home-translated');
  });

  it('falls back to the provided English literal when the key is missing', () => {
    render(<LanguageProvider><TestConsumer /></LanguageProvider>);
    expect(screen.getByTestId('missing')).toHaveTextContent('Articles');
  });
});
