---
title: "Slice 3 (SCHE-08): admission unit schema, tolerant decoder and units gate implemented"
date: 2026-11-14
kind: checkpoint
lane: "feat/local-proof-admission-unit"
reversal: "Revert the slice 3 PR; with the units gate off nothing on disk changed, and records written while it was on still decode on older revisions."
---

Slice 3 lands SCHE-08's schema half on `feat/local-proof-admission-unit`: `AdmissionUnit`, `AdmissionWeightSource` and `AdmissionOwner` as optional keys on tickets, leases and the enqueue, admission, v3 release and withdrawal rows; `RecordedAdmissionWorkKind` as the tolerant reader of the persisted kind; and a `units` key on the v2 protocol marker, flipped with `bun run beep quality scheduler protocol --units on|off` and off by default (decision files `sche-08-admission-unit-schema` and `sche-08-units-protocol-gate`). Scheduler behaviour is unchanged: admission order, weights and the review-fix cap are as before, and with the gate off every record keeps origin/main's bytes. Gate evidence: `test/quality-scheduler-admission-unit.test.ts` (12 cases, Node and Bun, in-memory filesystem and a fixed procfs entry) covers the mixed-version decode in both directions, the gate off and on through `withQualityAdmission`, and a newer writer's lease charged instead of quarantined; the ciops frozen-journal replay is 41 of 41 (`evidence:s7` PASS) and stays 41 of 41 with the unit keys injected on every row (new `property 5b` in `apps/labs/ciops/test/projection.test.ts`). The gate stays off on the workstation until every live checkout runs this revision. Next for SCHE-08 is slice 6: the scheduler `Context.Service` facade and Cache's own work kind, written behind the same gate.
