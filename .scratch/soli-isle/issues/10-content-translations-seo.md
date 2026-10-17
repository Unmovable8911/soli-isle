# 10: Content translations & SEO language wiring

**What to build:** The Author maintains independent translation versions for Articles and Posts: add, edit, or delete a version per Locale, with its own title, summary, and body, and set which version is the work's default. A Reader requesting a Locale that has no version of a work sees the default version with a clear "no version in this language" notice — the URL keeps its prefix. The switcher marks which Locales actually exist for the current work. The Feed shows only Posts with a version in the current Locale. Category and Tag display names render per Locale. Language-interlink declarations list only real versions, and fallback pages carry noindex.

**Blocked by:** 02 — Locale routing & site chrome; 05 — First published Article; 07 — Public article reading; 08 — Post feed

**Status:** ready-for-agent

- [ ] The translation panel adds, edits, and deletes each Locale version independently for Articles and Posts; deleting one version leaves every other version intact.
- [ ] `defaultLocale` is editable and decides which version Content Fallback displays.
- [ ] A work requested in a Locale without a version shows the default version's content plus the "no version in this language" notice; the URL prefix stays as requested; the page is noindex.
- [ ] The language switcher on a work's page indicates which Locales actually have a version, and switching keeps the Reader on that work.
- [ ] The Feed in a given Locale shows only Posts that have a version in that Locale.
- [ ] Category and Tag names display in the current Locale.
- [ ] Language-interlink and canonical declarations reference only Locales with real versions.
