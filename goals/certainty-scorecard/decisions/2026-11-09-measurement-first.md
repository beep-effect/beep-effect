---
title: "Sequencing: measurement goes first, at most three open PRs in this packet"
date: 2026-11-09
reversal: "Let a sibling goal start against the exploration's baselines and record which of its claims stay unverified until the scorecard lands."
---

This goal has no upstream dependency and goes first: the other five goals read their acceptance numbers from the scorecard, the MEAS-02 attribution fix precedes any WaveOrder re-seed, and the ROUT-05 partition mapping precedes any census, ledger or route refinement replay. MEAS-01 slice 1 (CLI only) is one of the three PRs ready to open at graduation. The packet keeps at most three concurrently open PRs. Rejected: first three PRs only (no owner for the rest) and scorecard plus soundness only (defers the compute and local work the audit was asked for). Source: exploration `explorations/ten-minute-certainty/DECISIONS.md` (D19).
