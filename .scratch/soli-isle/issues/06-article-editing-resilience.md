# 06: Article editing resilience

**What to build:** The Author keeps writing while offline; local edits queue and sync automatically when the network returns. If the server copy changed while the Author was away, the Author is told explicitly — nothing is silently overwritten — and can either discard the local changes or save the local version as a new draft.

**Blocked by:** 05 — First published Article

**Status:** ready-for-agent

- [ ] Losing the network mid-edit does not block writing; on reconnect the local copy syncs to the server without further action.
- [ ] When the server copy has changed since the local copy's base version, the editor blocks the overwrite and offers two explicit choices: discard local changes, or save the local version as a new draft. Silent overwrite never happens.
- [ ] Closing the browser with unsynced local changes and reopening it recovers those changes.
