# 05: First published Article

**What to build:** The Author logs in and writes a long-form Article in a rich editor — headings, inline emphasis (bold/italic/strikethrough/underline/highlight), lists, task lists, quotes, code blocks, links, dividers, images — using slash commands, Markdown keyboard shortcuts, and Markdown paste, with undo/redo. They set title, Slug, summary, Category, and Tags; drafts save automatically; preview shows the published form. Publishing happens immediately or at a future Publish Time judged by the site timezone; Articles can be archived or permanently deleted with confirmation. Slugs renamed after publishing keep every old Slug resolving to the same Article; a permanently deleted Article answers 410, distinct from 404. Every publish writes a Revision snapshot; throttled edit-time snapshots are pruned automatically.

**Blocked by:** 01 — Project foundation & ops contract; 03 — Author auth & admin shell; 04 — Asset pipeline

**Status:** ready-for-agent

- [ ] The editor provides the core block set with Markdown keyboard shortcuts and slash-command insertion; pasting Markdown converts to blocks; undo/redo covers editing operations.
- [ ] The meta panel sets title, Slug, summary, one Category (selectable from the tree), and multiple Tags; new Categories and Tags can be created inline while writing.
- [ ] Images insert into the body via the shared picker and render in the editor.
- [ ] Drafts save automatically: edits first land in browser-local storage, then sync to the server on a throttle; throttled saves do not create Revision snapshots.
- [ ] Preview renders the Article exactly as it will appear when published.
- [ ] Publishing makes the Article visible to Readers; an Article with a future Publish Time stays hidden until that moment, judged by the site timezone — Publish Time is not a fourth Publication State.
- [ ] Archiving removes the Article from lists while its URL stays reachable; permanent deletion requires a confirmation step and its URL later answers 410.
- [ ] Renaming the Slug after publishing keeps every previous Slug resolving to the same Article.
- [ ] Publishing always creates a Revision snapshot; edit-time snapshots are throttled and pruned to "all publish snapshots plus the latest N automatic ones".
- [ ] Each work stores its translation shape from day one: at most one translation row per Locale (unique constraint) and a recorded `defaultLocale`; a Reader can never see an unpublished or not-yet-due Article.
