---
title: The hostile-input scale rows guard against hangs with a 30-second bound, not a performance target
date: 2026-11-23
reversal: Lower ELAPSED_BOUND_MS toward the measured local times and accept CI flakes on shared runners, or replace the bound with a growth-ratio check across input sizes.
governs:
  - test/hostile.test.ts#ELAPSED_BOUND_MS
enforcedBy: []
---

The scale and path-depth rows in the hostile suite assert an elapsed-time ceiling of 30 seconds.
The bound catches a hang or a quadratic blowup, which at these sizes would take minutes; it is not a speed budget.
Linear behaviour was measured out of band: 12.5k key-values parsed in 126 ms and 100k in 762 ms locally.
Shared CI runners measured about four times slower than local (5,955 ms for the 2 MB document that takes about 1.4 s locally), and the previous 5-second bound flaked there.
Rejected: a bound near the local timings, which turns runner noise into red builds without catching anything a 30-second bound misses.
