---
title: "Target: p95 push to every required context green on PR runs, beside runner-minutes per run"
date: 2026-11-09
reversal: "Supersede with a decision that names a different statistic, and re-baseline the scorecard history under it."
---

The scorecard's headline is the p95 time from a push to every required context green on pull-request runs, reported beside total runner-minutes per run; latency and compute are separate objectives and are never summed. It also reports whether every main commit got a hosted verdict, and local `yeet verify` and `yeet publish` p95. Rejected: a per-job wall target (the #3007 layout lowered the slowest Unit job from 1,108 to 650 s while raising Unit job-minutes from 151 to 202), and push to mergeable as the target (it would require changing the review window). Source: exploration `explorations/ten-minute-certainty/DECISIONS.md` (D2).
