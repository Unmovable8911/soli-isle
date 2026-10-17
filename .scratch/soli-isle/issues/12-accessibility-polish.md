# 12: Accessibility & display polish

**What to build:** All public pages meet the accessibility baseline: WCAG 2.1 AA contrast in both themes, complete keyboard-only reading and navigation with visible focus and a skip-to-content link, lightbox and gallery keyboard and focus behaviour, and no unnecessary motion under `prefers-reduced-motion`.

**Blocked by:** 07 — Public article reading; 08 — Post feed

**Status:** ready-for-agent

- [ ] Light and dark themes each meet AA contrast for body text and interactive elements.
- [ ] Every reading and navigation flow works with the keyboard alone; a skip-to-content link exists; focus is always visible.
- [ ] The lightbox closes with Esc, navigates with arrow keys, and manages focus (trap while open, restore on close); the Feed gallery supports arrow keys.
- [ ] With `prefers-reduced-motion` enabled, non-essential animations are disabled.
- [ ] Phone-width reading is verified for Article pages and the Feed.
