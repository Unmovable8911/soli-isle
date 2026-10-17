# 07: Public article reading

**What to build:** Readers browse the public Article side: a home page of recent Articles, hierarchical Category browsing with breadcrumbs, Tag pages, a time archive, and on-site search with highlighted matches. The Article page renders the full core block set — code with syntax highlighting, images at original ratio with a lightbox for zoom (Esc closes, arrows navigate, focus managed), very tall images contained instead of cropped — plus previous/next navigation. Permanently deleted Articles answer 410; archive and search pages carry noindex; the sitemap lists only indexable Articles; shared links carry correct title, summary, and image metadata. Everything reads comfortably on phones.

**Blocked by:** 02 — Locale routing & site chrome; 05 — First published Article

**Status:** ready-for-agent

- [ ] The home page lists recent published Articles with title, summary, publish time, and Category.
- [ ] Category browsing works as a tree with breadcrumbs showing the path; Tag pages list all Articles sharing a Tag; an archive lists all Articles by time.
- [ ] Search matches title, body, Tag names, and Category names, filtered to the current Locale, and highlights the matched keywords; the search page is noindex.
- [ ] The Article page renders all core blocks; code blocks get syntax highlighting and correct monospace layout; images show at original ratio clamped to a maximum width; extremely tall images are contained by a viewport-height limit rather than cropped.
- [ ] Clicking a body image opens the shared lightbox: original size, Esc to close, arrow keys to navigate, focus managed.
- [ ] Every Article page ends with previous/next or related-Article navigation.
- [ ] Old Slugs resolve to the current Article URL; permanently deleted Articles answer 410; everything else unknown answers 404.
- [ ] Archive pages carry noindex; the sitemap contains only indexable Article URLs; shared-link metadata (title, summary, image) is emitted.
- [ ] Article pages are mobile-first: comfortable reading on phone widths.
