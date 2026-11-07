---
title: "Avoid reserving unchanged owned cleaner input twice"
date: 2026-11-06
kind: checkpoint
lane: "feat/citation-diff-kernel"
pullRequest: 2737
reversal: "Revert this checkpoint and accounting change together; restore the parent-budget regression before changing the source reservation contract."
---

PR review found that an empty truthy generator charged an already-reserved source twice. Top-level runOwned now settles unchanged input locally while raw input and newly produced/nested text retain parent enforcement. The actual generator regression proves identity, four local units, four parent units, generator closure and raw-input refusal against the exhausted parent. Twenty-five focused tests, type/declaration checks, blocking laws and scoped Fallow pass. The evidence command uses the existing use-case package path. See history/evidence/2026-11-06-cleaner-unchanged-reservation.md. No parity obligations are promoted.
