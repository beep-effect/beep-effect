---
title: "Report coverage-verdict p95: the number that reopens Coverage Regression as a required context"
date: 2026-11-09
reversal: "Drop the coverage-verdict row and supersede, leaving the required-context question to a new operator ruling."
---

Heavy / Coverage Regression stays non-required and keeps gating Yeet mergeable. The scorecard reports push-to-coverage-verdict p95 per code head (measured p50 29 min when the plan was written) as its own row, because the gated candidate "Coverage Regression as a required context" reopens only when that p95 is under 10 minutes and the fixed context name has landed. The row must handle the conditional job name (Heavy / Coverage Regression or Coverage Artifact Migration). Rejected: making it required now (a 29-minute verdict on the required path) and dropping the gate (floor regressions reach main). Source: exploration `explorations/ten-minute-certainty/DECISIONS.md` (D6).
