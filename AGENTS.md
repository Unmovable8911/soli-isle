## Requirements

- Read atlas/INDEX.md at the start of every conversation for project context.
- Development runs in WSL. Docker needs Docker Desktop started manually on the Windows host.
- If Docker is unavailable, stop and ask the developer to start Docker Desktop; continue only after it works.

## Agent skills

### Issue tracker

Issues and specs for this repo live as markdown files under `.scratch/<feature-slug>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical roles keep their default label strings: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` at the repo root plus `docs/adr/`. See `docs/agents/domain.md`.
