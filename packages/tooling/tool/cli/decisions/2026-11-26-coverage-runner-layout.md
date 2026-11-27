---
title: coverage producers run two at a time with one Vitest worker each, a shard with two
date: 2026-11-26
reversal: Run one producer per step with Vitest's default worker count, and discover owners two at a time.
governs:
  - src/commands/Ci/CiCoverage.ts#CI_COVERAGE_COMPOUND_STEP_CONCURRENCY
  - src/commands/Ci/CiCoverage.ts#CI_COVERAGE_SHARD_WORKERS_ARG
  - src/commands/Ci/CiCoverage.ts#CI_COVERAGE_DISCOVERY_CONCURRENCY
enforcedBy: []
---

Hosted ubuntu runners expose 4 vCPUs. With `--maxWorkers=1` per producer, two producers fit beside the step runner without exceeding the 16 GB the one-worker pin was sized for; their steps are buffered so the two logs do not interleave. A sharded partition runs a single producer, so it takes both worker slots (`--maxWorkers=2`): the same two Vitest workers and the same memory. With one worker a shard used one of four vCPUs (run 42726850927, repo-cli-3: 562 s of Vitest for 452 s of file time, strictly serial). Discovery is one CPU-bound `vitest list` boot per invocation, about 1.4 s; the Coverage Regression consumer discovers every owner (199 invocations took 139 s at two at a time on run 42554761567), so it runs four at a time, one per core.

Rejected: one producer per step (idles three of four vCPUs); a one-worker shard (strictly serial, above); two-at-a-time discovery (139 s on the consumer).
