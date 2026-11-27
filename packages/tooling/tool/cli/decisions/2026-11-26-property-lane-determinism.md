---
title: the per-PR property lane runs a fixed seed at a 400-run floor under a concurrency cap
date: 2026-11-26
reversal: Let fast-check pick a seed and its 100-run default, and drop the lane's --concurrency=4.
governs:
  - src/commands/Ci/CiLane.ts#DEFAULT_PROPERTY_LANE_SEED
  - src/commands/Ci/CiLane.ts#DEFAULT_PROPERTY_LANE_RUNS
  - src/commands/Ci/CiLane.ts#CI_LANE_TURBO_CONCURRENCY_ARG
enforcedBy: []
---

A fixed fast-check seed (one-round-loop P1) makes the lane deterministic, so a local `beep ci lane property` and the CI Property Laws lane, which runs the same command, test identical inputs and a local green predicts a CI green. The nightly sweep passes a new seed every run, for breadth. Runs and seed are read as floors of fixed constants: a blank `--runs ""` would reach the lane as `BEEP_FC_NUM_RUNS=""`, which the parsers treat as absent (fast-check's 100-run default), and a blank `--seed ""` would drop determinism, so blank input normalizes back to the floor.

The lane invokes Turbo directly, not through a root script, so it misses the CI concurrency cap in Quality/Tasks.ts; Turbo's default (~10) starved the hosted runner into 5-minute Vitest timeouts (workspace-use-cases property suite; goals/quality-speedup/research/instantiation-census.md §5). Lane replay is CI-parity by design, so the cap applies unconditionally. `--continue=dependencies-successful` keeps sweeping after one red suite, so a nightly run reports every failing package (#2687).

An unfiltered sweep has two steps that always both run, so one red suite never hides the other: the `test:property` scripts, then Turbo's `test` task, uncached, over packages with property files and no such script, which Vitest narrows to those files. An empty swept list means the census is wrong, and with no filter Turbo would run every package's tests, so it fails. A `--shard` reaches each package's own `vitest run` behind Turbo's `--`.

Rejected: a random per-run seed on pull requests (local green no longer predicts CI); Turbo's default concurrency (the timeouts above).
