import { render, screen, act } from '@testing-library/react';
import { beforeEach, describe, it, expect } from 'vitest';
import { ThemeProvider, useTheme } from '../src/contexts/ThemeContext.js';

function Probe() {
  const { theme, toggleTheme } = useTheme();
  return <button onClick={toggleTheme} data-theme-value={theme}>{theme}</button>;
}

describe('ThemeProvider', () => {
  beforeEach(() => { localStorage.clear(); document.documentElement.removeAttribute('data-theme'); });

  it('defaults to light when no stored choice and system is light', () => {
    render(<ThemeProvider><Probe /></ThemeProvider>);
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(screen.getByRole('button').textContent).toBe('light');
  });

  it('uses the stored choice over system', () => {
    localStorage.setItem('soli-isle-theme', 'dark');
    render(<ThemeProvider><Probe /></ThemeProvider>);
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('toggles and persists', () => {
    render(<ThemeProvider><Probe /></ThemeProvider>);
    act(() => { screen.getByRole('button').click(); });
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem('soli-isle-theme')).toBe('dark');
  });
});
