---
title: hosted check.yml lanes size their Turbo and Fallow concurrency to the 4-vCPU, 16 GB ubuntu runner
date: 2026-11-26
reversal: Let hosted lanes inherit the fleet default that boundedRootTurboArgs applies in CI, and run every Fallow sub-lane at once.
governs:
  - src/commands/Ci/CiLane.ts#HOSTED_16GB_TURBO_CONCURRENCY_ARG
  - src/commands/Ci/CiLane.ts#DOCS_POLICY_TURBO_CONCURRENCY_ARG
  - src/commands/Ci/CiLane.ts#FALLOW_SUB_LANE_CONCURRENCY
  - src/commands/Ci/CiLane.ts#runCiFallowLane
enforcedBy: []
---

Lint and Test Unit run on hosted 16 GB ubuntu-24.04 runners (check.yml), not the 32 GB beep-fleet-heavy fleet, so they keep the 16 GB-survival Turbo cap of 2.
Docs Policy's tasks are file walkers and git reads with no compiler or test worker in the graph, so it takes 4 on the 4-vCPU runner.
Fallow's sub-lanes write disjoint envelopes, so they run abreast, three at a time, about three Fallow project graphs on the runner; `--serial` (a forced run on a worker host) holds one graph at a time.

Rejected: the fleet default on hosted runners, which exhausts 16 GB.
