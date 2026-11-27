---
title: The decision append and the chain advance run as one uninterruptible step
date: 2026-11-26
reversal: Drop Effect.uninterruptible around the decision append and the run-state update.
governs:
  - src/GovernedTierGate/GovernedTierGate.gate.ts#makeGovernedTierGate
  - src/GovernedEgress/GovernedEgress.fetch.ts#makeGovernedEgressFetch
enforcedBy: []
---

Both boundaries append the write-ahead decision and then advance the in-memory chain (last hash, next sequence) inside one `Effect.uninterruptible` region. An interruption between a successful append and the advance would strand the run on a sequence slot the ledger already holds, and every later decision of the run would then fail the chain key and be refused.

Rejected: an interruptible append, which stays green in every test that never interrupts a dispatch.
