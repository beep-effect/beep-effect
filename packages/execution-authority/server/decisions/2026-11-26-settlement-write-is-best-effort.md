---
title: Settlement outcome writes are best effort and never retried
date: 2026-11-26
reversal: Keep a failed outcome queued and retry it, and wait for the egress outcome write without a timeout.
governs:
  - src/GovernedEgress/GovernedEgress.fetch.ts#outcomeAppendTimeout
  - src/GovernedTierGate/GovernedTierGate.gate.ts#makeGovernedTierGate
enforcedBy: []
---

An outcome is written after the effect already ran, so its failure never fails the dispatch or the request. A failed or timed-out write is logged at warning with its cause, and the decision stays allowed with no outcome, which `readUnsettledAllowed` reports as "decided, outcome unknown": the request did go out and nobody can say how it ended. The gate drops the pending outcome before it attempts the write, since no retry is coming. Egress bounds the write at one second, about 500 times a measured PGlite append of roughly 2 ms, so a timeout means an unwell ledger, not a busy one.

Rejected: an unbounded egress write, which holds the caller's response hostage to a stalled ledger; a bound near the measured append time, which turns a merely busy ledger into outcome-unknown rows; and a pending outcome kept queued for a retry that never comes.
