---
title: "Source-resolved checking (no dist, no project references) is rejected"
date: 2026-11-10
reversal: "Re-run the exploration's Experiment 3; reopen at decompose if the per-project wall ratio falls under about 1.3x or stale-dist failures recur."
---

Measured across all 199 check projects: 187 pass from source, at a median 2.3x wall and 1.46x memory per project (87.4 s against 31.9 s serial; peak 4.0 GB against 2.5 GB). One consumer failed inside a dependency's source because that source was checked under the consumer's compiler options. The cost lands on the per-package check every lane runs most, and #1874 already removed the incident that motivated it. Operator ruling.

Source: exploration `explorations/build-pipeline-simplification/DECISIONS.md` (Q7).
