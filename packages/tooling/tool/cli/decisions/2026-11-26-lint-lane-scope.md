---
title: Lint runs only the package Turbo graph, and Lint Policy states its scope in its argv
date: 2026-11-26
reversal: Run the root bun run lint aggregate in the Lint context and let Lint Policy read its scope from CI=true.
governs:
  - src/commands/Ci/CiLane.ts#ciLaneStepsForTesting
enforcedBy: []
---

Required Lint Policy owns the repo-policy battery, so the Lint context runs only the package Turbo graph instead of duplicating that battery through the root `bun run lint` aggregate.
The lane invokes Turbo directly, bypassing Quality/Tasks.ts turboRunArgs, so the hosted product-partition filter is applied in the lane; root commands include labs.
Lint Policy's argv states its scope instead of inheriting it from ambient `CI=true`: pull requests run the changed scope, which `beep lint policy` widens to the full sweep on deletions, `@deprecated`, tsconfig, dependency, Turbo, lint-config or policy-implementation changes, and pushes and local replays without the affected shape run `--full`.
`--summarize` is accepted for the shared matrix argv, because the policy graphs always write their Turbo summaries.

Rejected: the root lint aggregate in Lint (the battery runs twice); ambient-CI scope (local replays and hosted runs diverge).
