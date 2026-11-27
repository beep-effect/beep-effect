---
title: coverage producers run two at a time, and owner discovery four at a time, on the 4-vCPU runner
date: 2026-11-26
reversal: Run one coverage producer per step, and discover owners two at a time.
governs:
  - src/commands/Ci/CiCoverage.ts#CI_COVERAGE_COMPOUND_STEP_CONCURRENCY
  - src/commands/Ci/CiCoverage.ts#CI_COVERAGE_DISCOVERY_CONCURRENCY
enforcedBy: []
---

Hosted ubuntu runners expose 4 vCPUs. With `--maxWorkers=1` per producer, two producers fit beside the step runner without exceeding the 16 GB the one-worker pin was sized for; their steps are buffered so the two logs do not interleave.
Discovery is one CPU-bound `vitest list` boot per invocation, about 1.4 s. The Coverage Regression consumer discovers every owner (199 invocations took 139 s at two at a time on run 42554761567), so it runs four at a time, one per core; a producer only discovers its own partition.

Rejected: one producer per step, which idles three of four vCPUs; two-at-a-time discovery, which took 139 s on the consumer.
