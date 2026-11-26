---
title: Values two internal modules both need live in a leaf module that imports neither consumer
date: 2026-11-25
reversal: Inline each shared reader, helper or constant into every module that consumes it, or import it from one consumer into the other, and delete the leaf module.
governs:
  - src/internal/limits.ts#MAX_ENUMERATION_DEPTH
  - src/internal/workspaceYaml.ts#configDependenciesOf
  - src/internal/workspaceYaml.ts#inlinePeerDependencyRules
  - src/internal/configDependencyShared.ts#hooksError
  - src/internal/configDependencyShared.ts#ioOrNone
enforcedBy: []
---

`limits.ts` holds the package's bound constants, so every surface imports one number without an import cycle.
`configDependencyShared.ts` holds what the config-dependency ladder (`configDependencyResolution.ts`) and its fetch rung (`configDependencyFetch.ts`) share: the typed `hooks` failure, the absent-or-typed filesystem read, the manifest-version reading and the message helpers. It imports neither, so both import it without a cycle.
`workspaceYaml.ts` holds the `configDependencies` and inline `peerDependencyRules` readers that both the live assembler (`WorkspaceCatalogs`) and the at-ref reader (`WorkspaceSnapshots`) feed the hook replay with, so the two sides of a diff cannot disagree about what a ref declared.
Rejected: a copy per consumer, because two copies drift and a diff would then compare two readers rather than two refs.
Rejected: housing the shared helpers in the ladder and importing them into the fetch rung, because the ladder already imports the fetch rung (`FetchRequest`), so that import would close a cycle.
