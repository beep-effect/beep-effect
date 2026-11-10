---
title: "Every main commit gets a hosted verdict as part of the target"
date: 2026-11-09
reversal: "Re-rule D2 in the exploration so the target counts PR runs only; this goal then stops reporting the main verdict rate."
---

The program's target is p95 push-to-every-required-context-green on PR runs, reported beside runner-minutes per run, plus a completed hosted verdict for every main commit. A per-job target was rejected because main runs serialize and 12 of 15 were cancelled on 2026-11-09, so it would hide that most merged commits get no verdict. Since D28 this goal raises the interim rate and reports it: a non-docs main SHA counts as verdicted only when a Check push run for that exact SHA reaches success or failure; cancelled, missing or still-pending runs count as misses. The per-commit verdict itself arrives as the merge-group run under `merge-queue-activation`; the gap between the interim rate and the plan's 95% bar is recorded as that candidate's.
Source: exploration `explorations/ten-minute-certainty/DECISIONS.md` (D2, D28).
