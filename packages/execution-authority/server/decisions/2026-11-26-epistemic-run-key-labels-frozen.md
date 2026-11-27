---
title: The tier-gate and egress run-key labels keep their epistemic- prefix
date: 2026-11-26
reversal: Follow the reversal in goals/execution-authority-slice/decisions/2026-11-07-p1-runtime-names.md.
governs:
  - src/GovernedTierGate/GovernedTierGate.gate.ts#makeGovernedTierGate
  - src/GovernedEgress/GovernedEgress.fetch.ts#makeGovernedEgressFetch
enforcedBy: []
---

The `epistemic-run/` and `epistemic-egress/` run-key prefixes are digest inputs frozen by goals/execution-authority-slice/decisions/2026-11-07-p1-runtime-names.md. This file anchors that record at the two package sites that build them.
