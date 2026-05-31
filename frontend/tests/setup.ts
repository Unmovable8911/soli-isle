import '@testing-library/jest-dom';

if (!window.matchMedia) {
  // @ts-expect-error test stub
  window.matchMedia = (q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent() { return false; } });
}
