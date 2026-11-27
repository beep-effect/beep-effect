---
title: the property lane caps Turbo at --concurrency=4 in every replay
date: 2026-11-26
reversal: Drop CI_LANE_TURBO_CONCURRENCY_ARG and let the lane take Turbo's default concurrency.
governs:
  - src/commands/Ci/CiLane.ts#CI_LANE_TURBO_CONCURRENCY_ARG
enforcedBy: []
---

The lane invokes Turbo directly, not through a root script, so it misses the CI concurrency cap in Quality/Tasks.ts.
Turbo's default (about 10) starved the hosted runner into 5-minute Vitest timeouts in the workspace-use-cases property suite (goals/quality-speedup/research/instantiation-census.md §5).
Lane replay is CI-parity by design, so the cap applies unconditionally.

Rejected: Turbo's default concurrency, which produced the timeouts above.
