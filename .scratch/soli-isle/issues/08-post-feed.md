# 08: Post feed

**What to build:** The Author posts short, untitled Posts — body, multiple images, Tags — from a quick admin composer with the same draft/schedule/archive/permanent-delete lifecycle as Articles. Readers see the Feed: Posts in reverse chronological order, first batch server-rendered, a "load older" button appending the next page without changing the URL. Cards show only relative time (hover reveals the exact absolute time), body, a horizontal image gallery (next-image edge peeking, per-image snap, current/total counter, arrow keys), and Tags; over-tall bodies fold with an inline "展开全文". Tapping a Tag filters the Feed. Posts have no standalone page, are noindex, and never enter the sitemap.

**Blocked by:** 04 — Asset pipeline; 07 — Public article reading

**Status:** ready-for-agent

- [ ] The composer publishes a Post with body, multiple images, and Tags; a Post has no Slug and no Category.
- [ ] Posts share the full lifecycle: draft, scheduled Publish Time judged by the site timezone, archived, permanently deleted with confirmation.
- [ ] The Feed renders its first batch server-side; "load older" appends the next page without changing the URL; the control is absent when nothing older exists.
- [ ] A card shows only relative time, body, image gallery, and Tags — no avatar, handle, engagement controls, share controls, or per-Post link.
- [ ] Relative time is computed once at render and stays fixed; the machine-readable absolute time is emitted; hovering shows the exact time down to the minute.
- [ ] The gallery scrolls horizontally with the next image's edge visible, snaps per image, shows a `current/total` counter, supports arrow keys, and opens the shared lightbox on tap.
- [ ] Post bodies taller than the fold collapse with "展开全文" that expands in place without a request; the composer shows no character count and enforces no length limit.
- [ ] Tapping a Tag shows only Posts carrying that Tag.
- [ ] The Feed is noindex, contributes nothing to the sitemap, and no standalone Post page exists.
