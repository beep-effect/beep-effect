---
title: "COVE-08 fixed comparator context name now; Coverage Regression stays non-required and gates mergeable"
date: 2026-11-09
reversal: "Restore the conditional job name on the coverage-regression job in check.yml; the policy itself is unchanged by this decision."
---

Heavy / Coverage Regression stays a non-required context that still gates Yeet mergeable, and this goal lands the fixed-context-name slice (COVE-08) now, so a later promotion needs no migration. The job is not made required here: that would put a 29-minute push-to-verdict on the required path and block merges on inherited coverage reds. Dropping the gate was rejected by both seats, because floor regressions would reach a main that mostly gets no verdict. Promotion is revisited only once the nightly scorecard shows coverage-verdict p95 under 10 minutes.
Source: exploration `explorations/ten-minute-certainty/DECISIONS.md` (D6).
