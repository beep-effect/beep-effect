---
title: "Publish complete cache entries by staging and atomic rename"
date: 2026-11-26
reversal: "Return to direct cache copies only with an equivalent complete-entry visibility guarantee and a safe shim publication boundary."
governs:
  - "src/ToolInstaller.ts#make"
  - "src/PackageManagerInstaller.ts#make"
enforcedBy: []
---

Stage complete tools under the cache root, then rename the complete entry into its final path. A cache hit must never observe a half-copied tool; same-filesystem staging makes publication a rename instead of a cross-filesystem copy.
Move the source tree into staging by rename first, removing the reserved empty staging directory because Windows cannot rename over it. Copy only for EXDEV; permission and other failures remain failures, rather than being disguised by a slow fallback. After a successful copy, remove the source best-effort because the entry is already complete.
Write package-manager shims into the staged tree while naming the final cache path in their contents. Ask ToolInstaller for that path rather than deriving root or arch twice. cacheDir consumes packageDir, so no reads or writes may follow it.
On cache-hit shim regeneration, source and final directories coincide and existing shims stay untouched; the cache entry may belong to another writer.
Rejected: copy directly into the public cache directory or write shims after publication; partial entries would look like hits, persist across runs and prevent re-download.
