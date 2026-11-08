---
title: "final-check records computeProfile and forceLocal as optional receipt keys and fails on an unreadable override"
date: 2026-11-08
lane: "goals/compute-profile-gate-routing-p1"
reversal: "Remove the two optional keys from FinalCheckReceipt and the resolveFinalCheckProfileSkips call; old and new receipts both still decode."
---

The receipt keys are optionalKey so receipts written before P1 decode unchanged. An unreadable BEEP_COMPUTE_PROFILE override fails final-check with exit 2 instead of silently running the hosted-only gates. An operator --skip for a gate wins over the profile skip and keeps its own reason.
