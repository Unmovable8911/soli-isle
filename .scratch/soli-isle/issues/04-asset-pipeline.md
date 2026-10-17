# 04: Asset pipeline

**What to build:** The Author picks images and they upload immediately, stored in the image volume with generated thumb and display variants plus the original; content references a stable relative address that survives domain and storage changes. The admin asset library lists every uploaded image with its size and where it is referenced; images referenced by nothing are listed separately and deleted only after the Author confirms manually.

**Blocked by:** 01 — Project foundation & ops contract; 03 — Author auth & admin shell

**Status:** ready-for-agent

- [ ] Selecting an image uploads it immediately, records it (file name, dimensions, byte size, content hash, upload time), and generates a thumb variant (~800 px) and a display variant (~1600 px WebP) while keeping the original.
- [ ] Content bodies reference images only by stable relative addresses with no scheme and no domain.
- [ ] The asset library shows all uploads with sizes and which content references each; a separate list shows only images referenced by nothing.
- [ ] Deleting an unreferenced image requires explicit Author confirmation; nothing is ever auto-deleted.
- [ ] A reusable image picker exists for the later content editors to embed.
