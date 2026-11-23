---
title: A release-age gate counts finite minutes, not integer minutes
date: 2026-11-23
reversal: Add S.isInt() to AgeMinutes and make combine round each contribution before taking the maximum.
governs:
  - src/ReleaseAgeGate.ts#AgeMinutes
enforcedBy: []
---

pnpm configures the minimum release age as a non-negative integer of minutes, but `combine` takes the maximum of the finite contributions from every config source, and a contribution need not be a whole number.

`AgeMinutes` therefore admits any non-negative finite number, so every finite contribution is a valid gate and `combine` stays total.

Rejected: an integer check on `AgeMinutes`, which makes a fractional contribution fail at construction and turns `combine` partial.
