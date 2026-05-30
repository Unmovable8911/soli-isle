import { useEffect, useState } from 'react';
import type { TocEntry } from '../hooks/useToc.js';

export function ArticleToc({ entries }: { entries: TocEntry[] }) {
  const [active, setActive] = useState<string>('');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (entries.length === 0) return;
    const obs = new IntersectionObserver((items) => {
      for (const it of items) if (it.isIntersecting) setActive((it.target as HTMLElement).id);
    }, { rootMargin: '0px 0px -70% 0px', threshold: 0 });
    for (const e of entries) { const el = document.getElementById(e.id); if (el) obs.observe(el); }
    return () => obs.disconnect();
  }, [entries]);

  if (entries.length < 2) return null;

  return (
    <nav className={`article-toc${open ? ' is-open' : ''}`} aria-label="Table of contents">
      <button type="button" className="article-toc__toggle" aria-expanded={open}
        onClick={() => setOpen(o => !o)}>Contents</button>
      <ul className="article-toc__list">
        {entries.map((e) => (
          <li key={e.id} className={`article-toc__item article-toc__item--l${e.level}`}>
            <a href={`#${e.id}`} className={active === e.id ? 'active' : ''}
              onClick={() => setOpen(false)}>{e.text}</a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
