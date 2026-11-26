---
title: PGlite's runtime assets ride file imports, and the btree_gist bundle is materialized per boot into a private temp directory
date: 2026-11-26
reversal: Load btree_gist through the @electric-sql/pglite/contrib/btree_gist export and hand PGlite the asset paths directly.
governs:
  - src/runtime/Pglite.ts#materializeBtreeGistBundle
  - src/runtime/Pglite.ts#makeBundledPgliteLayer
enforcedBy: []
---

The PGlite wasm, data and extension files are `type: "file"` imports: Bun resolves them while compiling the sidecar executable, and Vite serves the same files through `/@fs/` in integration tests.
The bundled migrations issue `CREATE EXTENSION btree_gist` (the epistemic bitemporal edge exclusion constraint), so every PGlite instance the app opens registers it, the compatibility probe as much as the live database. Caller-supplied extensions merge on top rather than replace.
The contrib export resolves its tarball relative to its own module URL, which does not exist inside the compiled single-file executable, and PGlite's extension loader reads `file://` bundles through node:fs, which cannot open the executable's embedded `$bunfs` assets. So the bytes are copied once per boot into a private, unpredictable, exclusively created temp directory, and PGlite gets that URL; exclusive creation stops another local process from pre-positioning or swapping the loadable extension.
Rejected: the contrib export (unresolvable in the compiled sidecar); a fixed or shared temp path (a local process could plant the extension PGlite loads).
