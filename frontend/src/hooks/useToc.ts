import { useEffect, useState, type RefObject } from 'react';

export interface TocEntry { id: string; text: string; level: 2 | 3; }

export function slugify(text: string): string {
  return text.toLowerCase().trim()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function sameEntries(a: TocEntry[], b: TocEntry[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i]!.id !== b[i]!.id || a[i]!.text !== b[i]!.text || a[i]!.level !== b[i]!.level) return false;
  }
  return true;
}

export function useToc(ref: RefObject<HTMLElement | null>, deps: unknown[]): TocEntry[] {
  const [entries, setEntries] = useState<TocEntry[]>([]);
  useEffect(() => {
    const root = ref.current;
    if (!root) { setEntries([]); return; }

    const build = () => {
      const headings = Array.from(root.querySelectorAll('h2, h3')) as HTMLElement[];
      const seen = new Map<string, number>();
      const next: TocEntry[] = headings.map((h) => {
        const text = h.textContent?.trim() ?? '';
        const base = slugify(text) || 'section';
        const count = seen.get(base) ?? 0;
        seen.set(base, count + 1);
        const id = count === 0 ? base : `${base}-${count + 1}`;
        h.id = id;
        return { id, text, level: h.tagName === 'H3' ? 3 : 2 };
      });
      setEntries((prev) => (sameEntries(prev, next) ? prev : next));
    };

    build();
    const observer = new MutationObserver(() => build());
    observer.observe(root, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return entries;
}
