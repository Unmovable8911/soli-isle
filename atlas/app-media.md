# app-media

- **Parent**: app
- **Purpose**: Streams one stored Asset variant as immutable binary bytes at `GET /media/[assetId]/[variant]` by delegating to `mediaFileResponse(getAppContext().assets, assetId, variant)`.
- **Key Files**:
  - `src/app/media/[assetId]/[variant]/route.ts` (variant stream, module's only file)
- **Dependencies**: http, server
- **Dependents**: none
- **Exposes**: Nothing importable. The surface is the URL shape `/media/<assetId>/<variant>`, reached from `<img>` and `<video>` tags rather than from code; there is no session check, so possession of the Asset id is the only gate.

## Data Flow
1. A rendered Article or Post page emits `/media/<assetId>/<variant>` as an image or media URL.
2. `GET` awaits `params` for `assetId` and `variant`, then returns `mediaFileResponse(context.assets, assetId, variant)`.
3. `mediaFileResponse` re-parses the address through `parseAssetAddress` (`src/http/assets.ts:111`) and answers 404 when the pair does not parse.
4. `getAssetVariantFile` resolves the on-disk file for that variant and format; an absent or unreadable file also answers 404.
5. A readable file returns `200` with immutable cache headers (`src/http/assets.ts:128-132`).
