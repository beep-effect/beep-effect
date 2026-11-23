---
title: "Portable tsconfig carries types only on opt-in and never carries typeRoots"
date: 2026-11-22
reversal: "Add types to the unconditional allow-list in src/PortableTsconfig.ts and drop PortableTsconfigOptions.includeTypes, which is a breaking public API change needing a major changeset."
governs:
  - src/PortableTsconfig.ts#OPT_IN_TYPES_OPTION
  - src/PortableTsconfig.ts#PortableTsconfigOptions
enforcedBy: []
---

`types` passes the portability criterion (it holds package names, never a path) but is resolution-dependent, an axis the allow-list does not model. Emitting `types: ["node"]` makes tsc demand that `@types/node` resolve, a hard error in a virtual environment with no `node_modules`; omitting it lets TypeScript auto-include whatever `@types` exist and never error. Dropping it trades a loud cannot-find-type-definition failure for silently missing globals: better for an environment that materializes nothing, worse for one that materializes `@types` and needs to know which ones the config assumed. Neither default serves both, so the caller picks through `includeTypes`.

`typeRoots` stays dropped even under the opt-in: it names directories, absolute on a `ResolvedTsconfig` and relative to the source config on a bare options bag, meaningful only on the machine and at the config location they came from.

Rejected: carrying `types` by default (breaks environments with no `node_modules`) and dropping it unconditionally (virtual environments lost their Node globals).
