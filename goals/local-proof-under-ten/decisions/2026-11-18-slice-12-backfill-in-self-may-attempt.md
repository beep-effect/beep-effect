---
title: "Slice 12 (SCHE-06): verdict in selfMayAttempt behind default-off gates, with the journal tail-wait A/B"
date: 2026-11-18
kind: checkpoint
lane: "t3/local-proof-backfill-self-may-attempt"
reversal: "Delete this checkpoint with the slice; the gates default off, so it records code and evidence that change no admission."
---

Slice 12 lands the live port on `t3/local-proof-backfill-self-may-attempt` (decision file `sche-06-live-port-and-tail-wait-ab`). The SCHE-06 sections of repo-cli's `QualityScheduler.ts` and `QualityScheduler.schemas.ts` hold the verdict on live tickets and leases. `selfMayAttempt` applies it after the deployed skippable checks only while the protocol's new `backfill` or `fairness` key is on, and both default `off`. Under `easy`, tickets declare a journal-derived p90 ETA and stamp their bound when they become protected. `quality scheduler protocol` gains `--backfill` and `--fairness`. With both keys off, no record changes. The ciops lab gains `JournalReplay.ts` and `apps/labs/ciops/scripts/backfill-ab.ts`, the A/B over a recorded journal. On 377 recorded chains, backfill fired zero times in every arm, because heavy work is one 3-token kind, and fairness raised the p99 and max waits at capacities 8 and 6. The gates stay off: the driver decides, and the A/B is re-run once slice 13 puts mixed-weight units on the queue. Gate evidence: `test/quality-scheduler-backfill.test.ts` (14 cases, including 400 seeded queues on which modes-off equals the deployed rule) and `apps/labs/ciops/test/backfill-journal-replay.test.ts`.
