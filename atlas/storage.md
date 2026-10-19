# storage

- **Purpose**: Owns the two filesystem adapters that write under a single root directory — `AssetFileStore` places per-Asset variant image files and `FileSystemResourceStorage` proves the resource directory is writable and readable.
- **Key Files**:
  - `src/storage/asset-file-store.ts` (Asset variant files on disk)
  - `src/storage/filesystem-resource-storage.ts` (resource directory health probe)
- **Dependencies**: domain
- **Dependents**: server, services, test
- **Exposes**:
  - `class AssetFileStore` — `constructor(rootDir)` (resolved absolute), `assetDir(assetId)`, `variantPath(assetId, variant, format)`, `writeVariantFile(assetId, variant, format, bytes)` → absolute path, `removeAsset(assetId)`. Layout is `<rootDir>/assets/<assetId>/<variant>.<ext>`; a non-UUID Asset id, AssetVariant or AssetFormat is rejected with a thrown `Error` before any I/O.
  - `class FileSystemResourceStorage` — `constructor(rootDir)`, `checkAvailability()`; used by `src/server/app-context.ts` and `src/test/harness.ts`.
  - Format, variant and id validation is delegated to `@/domain/asset-address` (`isSafeAssetId`, `isAssetVariant`, `isAssetFormat`, `assetFileExtension`) — the only outbound dependency.

## Data Flow
1. A service passes bytes plus an Asset id to `AssetFileStore.writeVariantFile`.
2. `assetDir` rejects a non-UUID id; `variantPath` validates AssetVariant and AssetFormat and yields `<rootDir>/assets/<assetId>/<variant>.<ext>`.
3. The Asset directory is created recursively and the bytes go into a dot-prefixed `<variant>.<uuid>.tmp` file opened with `flag: "wx"`.
4. `rename` swaps the temp file into its final path atomically; on failure the temp file is removed and the original error rethrown.
5. `removeAsset` deletes the whole per-Asset directory with `rm -rf`.
