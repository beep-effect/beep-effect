---
title: "Config symbols, span names and log subsystems take the slice name; digest prefixes stay frozen"
date: 2026-11-07
lane: "feat/execution-authority-slice"
reversal: "Restore the Epistemic* config symbols, the Epistemic.* span names and the epistemic_governed_* subsystem annotations"
---

EpistemicConfig, EpistemicServerConfig and the rest become ExecutionAuthority*. Spans Epistemic.{ExecutionLedger,GovernedTierGate,GovernedEgress}.* become ExecutionAuthority.*, and log subsystems become execution_authority_governed_*, because the instrumentation catalog keys span names by owning package. Hash and digest inputs stay byte-identical: the three epistemic-*/v1 labels and the run-key prefixes epistemic-run/ and epistemic-egress/. Each now carries a comment explaining why.
