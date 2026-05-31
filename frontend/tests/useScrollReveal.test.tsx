import { render } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { useScrollReveal } from '../src/hooks/useScrollReveal.js';

let lastCallback: (entries: { isIntersecting: boolean; target: Element }[]) => void;
beforeEach(() => {
  lastCallback = () => {};
  // @ts-expect-error test stub
  global.IntersectionObserver = class {
    constructor(cb: typeof lastCallback) { lastCallback = cb; }
    observe() {} unobserve() {} disconnect() {}
  };
});

function Probe() { const ref = useScrollReveal<HTMLDivElement>(); return <div ref={ref} className="reveal">x</div>; }

describe('useScrollReveal', () => {
  it('adds is-revealed when the element intersects', () => {
    const { container } = render(<Probe />);
    const el = container.querySelector('.reveal')!;
    expect(el.classList.contains('is-revealed')).toBe(false);
    lastCallback([{ isIntersecting: true, target: el }]);
    expect(el.classList.contains('is-revealed')).toBe(true);
  });
});
