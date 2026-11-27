---
title: The tier-gate and egress run-key labels keep their epistemic- prefix
date: 2026-11-26
reversal: Mint execution-authority run-key labels and accept that new runs key differently from stored ones.
governs:
  - src/GovernedTierGate/GovernedTierGate.gate.ts#makeGovernedTierGate
  - src/GovernedEgress/GovernedEgress.fetch.ts#makeGovernedEgressFetch
enforcedBy: []
---

Run keys digest `epistemic-run/<run id>/<freeze millis>` in the tier gate and `epistemic-egress/<freeze millis>/<grant-set digest>` in governed egress. Both labels come from the slice the boundaries began in, and they are digest inputs, so they stay byte-identical across the move. The slice move recorded the same rule for every hash label in goals/execution-authority-slice/decisions/2026-11-06-hash-domain-labels.md.

Rejected: labels renamed after the execution-authority slice, which changes every new run key.
