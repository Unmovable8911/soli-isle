import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../src/api/pages.js', () => ({
  usePages: () => ({ data: [
    { id: '1', slug: 'about', published_at: null, sort_order: 0, translation: { title: 'About' } },
    { id: '2', slug: 'colophon', published_at: null, sort_order: 1, translation: { title: 'Colophon' } },
  ] }),
}));
vi.mock('../../src/components/LanguageSwitcher.js', () => ({ LanguageSwitcher: () => null }));
vi.mock('../../src/components/ThemeToggle.js', () => ({ ThemeToggle: () => null }));
vi.mock('../../src/components/Footer.js', () => ({ Footer: () => null }));
const translations: Record<string, string> = {
  'nav.home': '主页', 'nav.articles': '文章', 'nav.moments': '瞬间', 'nav.resources': '资源',
};
vi.mock('../../src/contexts/LanguageContext.js', () => ({
  useLanguage: () => ({ t: (key: string, fallback?: string) => translations[key] ?? fallback ?? key }),
}));

import { Layout } from '../../src/components/Layout.js';

function renderLayout() {
  return render(
    <MemoryRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<div />} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

describe('Layout masthead pages', () => {
  it('renders a nav link per published page', () => {
    renderLayout();
    expect(screen.getByRole('link', { name: 'About' })).toHaveAttribute('href', '/about');
    expect(screen.getByRole('link', { name: 'Colophon' })).toHaveAttribute('href', '/colophon');
  });

  it('renders nav chrome labels via the active-language translation (not hardcoded English)', () => {
    renderLayout();
    expect(screen.getByRole('link', { name: '主页' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: '文章' })).toHaveAttribute('href', '/articles');
    expect(screen.getByRole('link', { name: '瞬间' })).toHaveAttribute('href', '/moments');
    expect(screen.getByRole('link', { name: '资源' })).toHaveAttribute('href', '/resources');
  });
});
