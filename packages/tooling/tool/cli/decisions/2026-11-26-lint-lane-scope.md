---
title: Lint runs only the package Turbo graph, and Lint Policy states its scope in its argv
date: 2026-11-26
reversal: Run the root bun run lint aggregate in the Lint context and let Lint Policy read its scope from CI=true.
governs:
  - src/commands/Ci/CiLane.ts#ciLaneStepsForTesting
  - src/commands/Ci/CiLane.ts#runCiLane
enforcedBy: []
---

Required Lint Policy owns the repo-policy battery, so the Lint context runs only the package Turbo graph instead of duplicating that battery through the root `bun run lint` aggregate. The lane invokes Turbo directly, bypassing Quality/Tasks.ts turboRunArgs, so the hosted product-partition filter is applied in the lane; root commands include labs under lab-apps-lifecycle D15.

Lint Policy's argv states its scope instead of inheriting it from ambient `CI=true`. Pull requests (perf audit K1) run the changed scope, which `beep lint policy` widens to the full sweep on deletions, `@deprecated`, tsconfig, dependency, Turbo, lint-config or policy-implementation changes; pushes and local replays without the affected shape run `--full`. `--summarize` is accepted for the shared matrix argv, because the policy graphs always write their Turbo summaries.

A docs_only pull request never starts Heavy / Lint Policy, so Docs Policy runs the policy tasks a documentation diff can fail (DocsPolicy.ts) in one Turbo graph, then the knowledge doctor against the review base, as the changed-scope Lint Policy plan does. The knowledge doctor reads only committed Git state (its own archive extractions of HEAD and the merge-base), never a Turbo output, so it runs abreast of the task graph; buffered output keeps each step's log whole and every red is still collected.

The JSDoc ratchet's inventory and compare are a dependency chain, so the lane fails fast and never compares yesterday's artifact after a failed scan. Hosted CI regenerates the inventory into .beep/ci/ and ratchets it; a caller that already ran the scan (root beep:preflight's `jsdoc-inventory` writes the same ignored copy) passes `--inventory <path>` and only the ratchet runs (quality-lane audit A3).

Rejected: the root lint aggregate in Lint (the battery runs twice); ambient-CI scope (local replays and hosted runs diverge).
