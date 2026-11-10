---
title: "Smoke-per-PR corpus replay stays gated on a 95% main verdict rate for 14 days"
date: 2026-11-09
reversal: "Re-rule D9 in the exploration; this goal's verdict-rate report is then informational only for the corpus replay."
---

Test Integration keeps the full canonical citation corpus replay on every PR. Smoke per PR plus a full replay on main is reconsidered only after the certainty scorecard shows the main verdict rate at or above 95% for 14 days; with a 13% rate a main or nightly replay would not reliably run, and the replay is the only production-deadline witness. This goal never proposes the smoke replay itself: it reports the 14-day rate, and the reopening belongs to the gated candidate in the exploration's MAP.md. `pr-head-slimming` in `explorations/github-merge-queue/MAP.md` cites D9 too. Rejected: smoke per PR now (proof-depth reduction, ruling 5).
Source: exploration `explorations/ten-minute-certainty/DECISIONS.md` (D9).
