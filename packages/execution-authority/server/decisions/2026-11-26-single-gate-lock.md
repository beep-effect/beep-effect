---
title: One lock serializes all run creation and decision appends in the tier gate
date: 2026-11-26
reversal: Replace the gate's single Semaphore with one lock per run id.
governs:
  - src/GovernedTierGate/GovernedTierGate.gate.ts#makeGovernedTierGate
enforcedBy: []
---

The tier gate holds one global lock across run resolution and the decision append, so each run's chain sequence stays dense and the read-then-insert of a new run in `resolveRun` never races another creator. The desktop surface has a single interactive caller, and the coarse critical section cannot deadlock because the governed effect itself always runs outside it.

Rejected: a lock per run id, which adds a lock map and its own creation race for no throughput the single caller can use.
