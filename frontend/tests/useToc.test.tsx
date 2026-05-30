import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useRef, useEffect } from 'react';
import { useToc, slugify } from '../src/hooks/useToc.js';

describe('slugify', () => {
  it('lowercases, trims, hyphenates', () => {
    expect(slugify('Hello World!')).toBe('hello-world');
    expect(slugify('  A  B  ')).toBe('a-b');
  });
});

function Probe({ html, onToc }: { html: string; onToc: (t: unknown) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const toc = useToc(ref, [html]);
  onToc(toc);
  return <div ref={ref} dangerouslySetInnerHTML={{ __html: html }} />;
}

describe('useToc', () => {
  it('builds entries from h2/h3 and assigns ids', () => {
    let result: any;
    render(
      <Probe html="<h2>First</h2><h3>Sub</h3><p>x</p><h2>Second</h2>" onToc={(t) => { result = t; }} />
    );
    expect(result).toEqual([
      { id: 'first', text: 'First', level: 2 },
      { id: 'sub', text: 'Sub', level: 3 },
      { id: 'second', text: 'Second', level: 2 },
    ]);
  });

  it('dedupes repeated heading slugs', () => {
    let result: any;
    render(<Probe html="<h2>Dup</h2><h2>Dup</h2>" onToc={(t) => { result = t; }} />);
    expect(result.map((e: any) => e.id)).toEqual(['dup', 'dup-2']);
  });

  it('rebuilds when content is injected asynchronously (MutationObserver)', async () => {
    const { waitFor } = await import('@testing-library/react');
    function Async({ onToc }: { onToc: (t: any) => void }) {
      const ref = useRef<HTMLDivElement>(null);
      const toc = useToc(ref, []);
      onToc(toc);
      // start empty; inject a heading after mount
      useEffect(() => { if (ref.current) ref.current.innerHTML = '<h2>Injected</h2>'; }, []);
      return <div ref={ref} />;
    }
    let result: any = null;
    render(<Async onToc={(t) => { result = t; }} />);
    await waitFor(() => { expect(result).toEqual([{ id: 'injected', text: 'Injected', level: 2 }]); });
  });
});
