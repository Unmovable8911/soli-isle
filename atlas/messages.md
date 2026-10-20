# messages

- **Purpose**: Exports the `messages` catalogue that maps every Locale to one nested `Messages` object holding the UI strings for `meta`, `chrome`, `home`, `admin` and `reader`.
- **Key Files**:
  - `src/messages/index.ts` (catalogue assembly, `Messages` type)
  - `src/messages/zh.json` (source-of-truth string shape, 449 leaves)
  - `src/messages/en.json` (English strings, type-checked against `zh`)
- **Dependencies**: config
- **Dependents**: app, app-admin, app-locale, components, components-admin, http
- **Exposes**:
  - `messages: Record<Locale, Messages>` — `{ zh, en }`, keyed by `Locale` from `@/config/site`.
  - `type Messages = typeof zh` — the catalogue shape is derived from `zh.json` and `en.json` is assigned through it (`const enMessages: Messages = en`), so zh is the schema and en is the constrained translation; both files carry the same 5 top-level sections.
  - No lookup, fallback or locale-negotiation helper exists; callers index `messages[locale]` themselves and own the Locale they resolved.
