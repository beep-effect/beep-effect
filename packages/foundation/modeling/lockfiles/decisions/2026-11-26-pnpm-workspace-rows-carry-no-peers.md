---
title: pnpm workspace rows carry no peer declarations
date: 2026-11-26
reversal: Read an importer's peerDependencies section into the workspace row's peerDependencies.
governs:
  - src/internal/pnpm.ts#toFields
enforcedBy: []
---

A pnpm lockfile records a workspace project's resolved dependencies only, never its own peer declarations; this was probed against pnpm 11.22.0 with and without `autoInstallPeers`. Workspace rows keep the empty peer defaults, and the importer path is both the row's name and its instance id; importer paths join the instance-id set because a `link:` edge names an importer by its path.

Rejected: treating an importer's `peerDependencies` section as declarations. It holds resolved `{ specifier, version }` pairs, so a consumer's peer check would read resolutions as ranges.
