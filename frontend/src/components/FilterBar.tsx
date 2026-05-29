import { useSearchParams } from 'react-router';
import { useCategories } from '../api/categories.js';
import { useTags } from '../api/tags.js';

export function FilterBar({ show }: { show: 'categories' | 'tags' | 'both' }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: categories } = useCategories();
  const { data: tags } = useTags();

  const activeCategory = searchParams.get('category');
  const activeTag = searchParams.get('tag');

  function toggleParam(key: string, value: string) {
    const next = new URLSearchParams(searchParams);
    if (next.get(key) === value) {
      next.delete(key);
    } else {
      next.set(key, value);
    }
    setSearchParams(next);
  }

  return (
    <div className="filter-bar">
      {(show === 'categories' || show === 'both') && categories && (
        <div className="filter-group">
          {categories.map(cat => (
            <button
              type="button"
              key={cat.id}
              className={`filter-pill ${activeCategory === cat.slug ? 'active' : ''}`}
              onClick={() => toggleParam('category', cat.slug)}
            >
              {cat.translation.name ?? cat.slug}
            </button>
          ))}
        </div>
      )}
      {(show === 'tags' || show === 'both') && tags && (
        <div className="filter-group">
          {tags.map(tag => (
            <button
              type="button"
              key={tag.id}
              className={`filter-pill ${activeTag === tag.slug ? 'active' : ''}`}
              onClick={() => toggleParam('tag', tag.slug)}
            >
              {tag.translation.name ?? tag.slug}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
