import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LanguageSwitcher } from '../../src/components/LanguageSwitcher.js';
import { LanguageProvider } from '../../src/contexts/LanguageContext.js';

beforeEach(() => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: true,
    json: () => Promise.resolve([
      { id: '1', code: 'en', name: 'English', is_default: 1 },
      { id: '2', code: 'zh', name: '中文', is_default: 0 },
    ]),
  } as Response);
  localStorage.clear();
});

function renderSwitcher() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <LanguageProvider>
        <LanguageSwitcher />
      </LanguageProvider>
    </QueryClientProvider>
  );
}

describe('LanguageSwitcher', () => {
  it('renders language options', async () => {
    renderSwitcher();
    expect(await screen.findByText('English')).toBeDefined();
    expect(screen.getByText('中文')).toBeDefined();
  });

  it('persists language selection to localStorage', async () => {
    renderSwitcher();
    const select = await screen.findByRole('combobox');
    await userEvent.selectOptions(select, 'zh');
    expect(localStorage.getItem('soli-isle-lang')).toBe('zh');
  });
});
