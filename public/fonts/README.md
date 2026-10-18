# Self-hosted fonts

Two latin-subset variable faces, served from this directory. Nothing is
requested from a CDN at runtime, so the reading experience does not depend on a
third party and leaves no request trail with one.

| File | Family | Axis | Source |
| --- | --- | --- | --- |
| `lora-latin-wght-normal.woff2` | Lora | `wght` 400–700 | `@fontsource-variable/lora@5.3.0` `files/lora-latin-wght-normal.woff2` |
| `inter-latin-wght-normal.woff2` | Inter | `wght` 100–900 | `@fontsource-variable/inter@5.3.0` `files/inter-latin-wght-normal.woff2` |

Fontsource publishes the upstream OFL builds with Google Fonts' subsetting
applied; the latin subset is the one this site serves. Upstream projects:

- Lora — <https://github.com/cyrealtype/Lora-Cyrillic>
- Inter — <https://github.com/rsms/inter>

Both are licensed under the SIL Open Font License 1.1; the full licence text
ships beside them as `OFL-Lora.txt` and `OFL-Inter.txt`, each with its own
copyright line and reserved font name.

To change a face, replace the `.woff2` here and update the `@font-face` block at
the top of `src/app/base.css`. `src/app/globals-css.test.ts` asserts that every
declared face resolves to a file in this directory, that `font-display` is
`swap`, and that no stylesheet names an external origin.
