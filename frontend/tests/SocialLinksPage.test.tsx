import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

const upsert = vi.fn();
vi.mock('../src/api/social-links.js', () => ({
  useAdminSocialLinks: () => ({ data: [{ id: '1', platform: 'github', url: 'https://github.com/me', is_enabled: 1, sort_order: 0 }], isLoading: false }),
  useUpsertSocialLink: () => ({ mutate: upsert, isPending: false }),
}));
import { SocialLinksPage } from '../src/pages/admin/SocialLinksPage.js';

describe('SocialLinksPage', () => {
  it('renders a row per catalog platform with the stored url prefilled', () => {
    render(<SocialLinksPage />);
    expect(screen.getByText('GitHub')).toBeInTheDocument();
    expect(screen.getByDisplayValue('https://github.com/me')).toBeInTheDocument();
    expect(screen.getByText('TikTok')).toBeInTheDocument(); // catalog platform with no stored row
  });
  it('saves a platform', () => {
    render(<SocialLinksPage />);
    fireEvent.click(screen.getAllByRole('button', { name: /save/i })[0]);
    expect(upsert).toHaveBeenCalled();
  });
});
