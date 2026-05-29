import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { ArticleCard } from '../../src/components/ArticleCard.js';

const mockArticle = {
  id: '1',
  slug: 'hello-world',
  cover_image: null,
  published_at: '2026-05-01T00:00:00Z',
  title: 'Hello World',
  excerpt: 'First post',
};

describe('ArticleCard', () => {
  it('renders title as link to article slug', () => {
    render(
      <MemoryRouter>
        <ArticleCard article={mockArticle} />
      </MemoryRouter>
    );
    const link = screen.getByRole('link', { name: 'Hello World' });
    expect(link.getAttribute('href')).toBe('/articles/hello-world');
  });

  it('renders excerpt text', () => {
    render(
      <MemoryRouter>
        <ArticleCard article={mockArticle} />
      </MemoryRouter>
    );
    expect(screen.getByText('First post')).toBeDefined();
  });
});
