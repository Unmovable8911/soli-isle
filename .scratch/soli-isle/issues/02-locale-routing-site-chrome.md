# 02: Locale routing & site chrome

**What to build:** Every page lives under a Locale prefix. Visiting the bare domain lands the Reader on their best language and remembers a manual choice, while a prefixed URL always shows its own Locale. The header switcher swaps Locale and keeps the Reader on the same page. All interface text comes from one JSON per Locale; a missing key fails the build instead of silently falling back. Light/dark theme follows the system, can be overridden manually, is remembered long-term, and never flashes the wrong theme on load.

**Blocked by:** 01 — Project foundation & ops contract

**Status:** ready-for-agent

- [ ] Prefixed URLs (e.g. `/zh`, `/en`) render the placeholder home in that Locale.
- [ ] Bare-domain visits respond with a temporary redirect (not 301) to the Locale chosen by `Accept-Language`, preferring the cookie-stored choice when present.
- [ ] A prefixed URL is never rewritten based on the cookie: the cookie only decides where the bare path lands.
- [ ] The language switcher replaces only the Locale prefix and keeps the rest of the path and query.
- [ ] Every UI string comes from the per-Locale JSON; omitting a key in any Locale fails the build, not the page.
- [ ] Theme: first load follows the system with no wrong-theme flash; a manual override persists across visits and takes precedence over the system setting.
