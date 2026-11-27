---
title: the direct-Turbo doctest and property lanes cap Turbo at --concurrency=4 in every replay
date: 2026-11-26
reversal: Drop CI_LANE_TURBO_CONCURRENCY_ARG so doctest, property and the property sweep take Turbo's default concurrency.
governs:
  - src/commands/Ci/CiLane.ts#CI_LANE_TURBO_CONCURRENCY_ARG
enforcedBy: []
---

The doctest, property and property-sweep lanes invoke Turbo directly, not through a root script, so
they miss the CI concurrency cap in Quality/Tasks.ts. Turbo's default (about 10) starved the hosted
runner into 5-minute Vitest timeouts in the workspace-use-cases property suite. Lane replay is
CI-parity by design, so all three take the cap unconditionally.

Rejected: Turbo's default concurrency, which produced those timeouts.
