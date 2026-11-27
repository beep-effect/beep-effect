---
title: hosted check.yml lanes pin concurrency to the 4-vCPU, 16 GB ubuntu runner
date: 2026-11-26
reversal: Let hosted lanes inherit the fleet default that boundedRootTurboArgs applies in CI, and Vitest's default workers.
governs:
  - src/commands/Ci/CiLane.ts#HOSTED_16GB_TURBO_CONCURRENCY_ARG
  - src/commands/Ci/CiLane.ts#DOCS_POLICY_TURBO_CONCURRENCY_ARG
  - src/commands/Ci/CiLane.ts#INTEGRATION_SHARD_VITEST_ARGS
  - src/commands/Ci/CiLane.ts#FALLOW_SUB_LANE_CONCURRENCY
enforcedBy: []
---

Lint and Test Unit run on hosted 16 GB ubuntu-24.04 runners (check.yml), not the 32 GB beep-fleet-heavy fleet, so they keep the 16 GB-survival Turbo cap of 2. Docs Policy's tasks are file walkers and git reads with no compiler or test worker in the graph, so it takes 4 on the 4-vCPU runner. Hosted integration shards run one Vitest worker: two workers gave almost no parallel gain (PR #3005 run 42600820554: 1.0-1.5x the 8-vCPU file-second sum) and the contention pushed native replays past their production operation and extraction deadlines, while single-file partitions on the same run, effectively one worker, all passed.

Fallow's sub-lanes write disjoint envelopes, so they run abreast, three at a time, about three Fallow project graphs on the 4 vCPU, 16 GB runner; `--serial` (a forced run on a worker host) holds one graph at a time. Status lines keep declaration order whatever order the sub-lanes finish in, and a permit stops two finishing sub-lanes from interleaving their writes. The check lane takes the D2 admission profile: a solo proof uses the measured-safe c3, any active sibling lease lowers it to c2, and hosted CI, which has no local admission lease, takes the conservative c2.

Rejected: the fleet default on hosted runners (16 GB exhaustion); two integration workers (missed deadlines above).
