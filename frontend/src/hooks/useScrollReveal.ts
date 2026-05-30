import { useCallback, useRef } from 'react';

export function useScrollReveal<T extends HTMLElement>() {
  const observerRef = useRef<IntersectionObserver | null>(null);
  return useCallback((node: T | null) => {
    if (observerRef.current) { observerRef.current.disconnect(); observerRef.current = null; }
    if (!node) return;
    if (typeof IntersectionObserver === 'undefined') { node.classList.add('is-revealed'); return; }
    const obs = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) { e.target.classList.add('is-revealed'); obs.unobserve(e.target); }
      }
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    obs.observe(node);
    observerRef.current = obs;
  }, []);
}
