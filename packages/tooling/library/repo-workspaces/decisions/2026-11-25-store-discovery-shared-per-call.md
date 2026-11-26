---
title: One resolvePnpmfiles call discovers stores and decodes recorded locks once, lazily, for all its entries
date: 2026-11-25
reversal: Run store discovery and the declaring side's lockfile decode inside resolveDirectory for each declared entry, attributing discovery IO failures to that entry's name.
governs:
  - src/internal/configDependencyResolution.ts#resolvePnpmfiles
  - src/internal/configDependencyResolution.ts#LadderCall
  - src/internal/configDependencyResolution.ts#discoverStores
  - src/internal/configDependencyResolution.ts#memoizeSuccess
enforcedBy: []
---

A `resolvePnpmfiles` call shares store discovery and the declaring side's lockfile decode across every declared entry through `LadderCall`.
Each runs lazily, on the first `.pnpm-config` miss and on the first fetch, through `memoizeSuccess`, so concurrent entries dedupe onto one run and a failed or interrupted run is retried by the next user.
Because discovery serves every dependency of the call rather than one, its IO failures are attributed to the workspace root.
Rejected: discovery per declared entry, which repeats the same store scan once per dependency and attributes a store failure to whichever dependency happened to trigger it.
Rejected: `Effect.cached`, which would pin an interrupt (KNOWLEDGE.md, operating rules on lazy init).
