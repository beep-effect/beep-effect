---
title: The config-dependency ladder and fetch rung read and write only through the caller's FileSystem and Path
date: 2026-11-25
reversal: Read the pnpm store, `.pnpm-config` and the scratch workspace through `node:fs` on the real disk, as the upstream ladder did, and stop requiring `FileSystem` and `Path` from the caller.
governs:
  - src/internal/configDependencyResolution.ts#resolvePnpmfiles
  - src/internal/configDependencyFetch.ts#makeFetchConfigDependency
  - src/internal/configDependencyShared.ts#ioOrNone
enforcedBy: []
---

Every read and write of the declared-version ladder and its fetch rung goes through the caller's `FileSystem` and `Path` services, and every environment value through `Config`.
Rejected: the upstream's direct `node:fs` reads of the real disk, which break the repo's Effect platform rule and leave the ladder untestable over a memory filesystem.
Accepted limit: the store and the scratch workspace are real directories, and the dynamic `import()` that loads a pnpmfile is real anyway, so a replaying layer needs a real `FileSystem` for pnpm and the import to see them. Over a virtual one the ladder finds no store and fails typed, naming what it searched.
