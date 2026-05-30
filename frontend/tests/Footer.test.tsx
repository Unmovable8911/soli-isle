import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, it, expect, vi } from 'vitest';

vi.mock('../src/api/social-links.js', () => ({
  usePublicSocialLinks: () => ({ data: [
    { id: '1', platform: 'github', url: 'https://github.com/me', is_enabled: 1, sort_order: 0 },
    { id: '2', platform: 'email', url: 'mailto:me@x.com', is_enabled: 1, sort_order: 1 },
  ] }),
}));
import { Footer } from '../src/components/Footer.js';

describe('Footer social links', () => {
  it('renders an accessible link per enabled platform', () => {
    render(<MemoryRouter><Footer /></MemoryRouter>);
    expect(screen.getByLabelText('GitHub')).toHaveAttribute('href', 'https://github.com/me');
    expect(screen.getByLabelText('Email')).toHaveAttribute('href', 'mailto:me@x.com');
  });
});
