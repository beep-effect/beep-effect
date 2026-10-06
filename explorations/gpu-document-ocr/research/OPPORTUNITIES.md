# Friction receipts

## 2026-10-06

1. **A safety gate copied from a stale note blocked work it did not govern.**
   Doing: the GPU stack check. Evidence: the brief required `iommu=pt` in
   `/proc/cmdline`; the box boots with `iommu.passthrough=0 iommu.strict=1`
   on purpose. The June note listed the flag beside the thermal gates.
   Prevention: a gate should name the hazard it guards (heat, power,
   peer-to-peer transfers) so a reader can tell when it applies. Recorded in
   `GPU-STACK.md`.

2. **The local model-server notes named the wrong backend.** Doing: choosing
   the lowest-risk engine path. Evidence: notes said the llama.cpp build is
   Vulkan; `CMakeCache.txt` of the current build says `GGML_HIP=ON`,
   `GGML_VULKAN=OFF`. Prevention: read the build cache, not the note.

3. **A fresh worktree cannot type-check a package until its dependencies are
   built.** Doing: `beep quality package-verify @beep/file-processing --quick`.
   Evidence: `error TS6305: Output file '.../dist/index.d.ts' has not been
   built from source file`. Fix used: `turbo run build
   --filter=@beep/file-processing...` first (7 s). Prevention: package-verify
   could build upstream `dist` itself or say which command to run.

4. **`vitest.aliases.generated.json` has no generator command an agent can
   find.** Doing: adding a package subpath export. Evidence: `beep
   tsconfig-sync` updated `tsconfig.json` and left the generated alias file
   stale; the quality gate only says "regenerate the alias data". The entry
   was added by hand to mirror `tsconfig.json`. Prevention: have
   `tsconfig-sync` write both files, or name the command in the diagnostic.

5. **"Born digital" cannot be decided from character counts.** Doing: picking
   benchmark controls. Evidence: three of four spot-checked high-text pages
   were scans with an OCR text layer. Prevention: the page probe proposed in
   `SEAM-DESIGN.md` section 6 (full-page raster present).
