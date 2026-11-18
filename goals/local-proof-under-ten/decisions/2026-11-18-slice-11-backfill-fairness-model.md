---
title: "Slice 11 (SCHE-06): backfill and fairness model with property laws in the ciops lab"
date: 2026-11-18
kind: checkpoint
lane: "t3/ciops-model-backfill-fairness"
reversal: "Delete this checkpoint with the slice; it records lab evidence and changes no scheduler behaviour."
---

Slice 11 lands SCHE-06's model on `t3/ciops-model-backfill-fairness` (decision file `sche-06-backfill-model`): `apps/labs/ciops/src/backfill/` holds the schemas, the `BackfillModel` service, the pure policy (protected ordering, origin-then-checkout fairness on windowed token-milliseconds, EASY backfill against the head's projected start, the conditional bound stamped at protection) and an event-driven simulator. `test/backfill-fairness.test.ts` (16 cases) states the SPEC laws under adversarial effect/Arbitrary streams (continuous tiny arrivals, a one-origin flood, oversized units, crashes and overruns) and two mutants that the laws reject. The live scheduler is unchanged; slice 12 ports `attemptVerdict` into `selfMayAttempt` behind the existing skippable checks and A/B-tests tail waits. SCHE-09's pressure stamps were switched on at 2026-11-17T23:46:54Z, which slice 12's A/B reads.
