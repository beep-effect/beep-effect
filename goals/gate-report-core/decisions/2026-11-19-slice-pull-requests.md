---
title: "The first slice lands as two pull requests: the model, then the services and wiring"
date: 2026-11-19
lane: "feat/gate-report-core"
reversal: "Open one pull request for P1 through P3 as the plan first said."
---

The plan lands P1 through P3 as one pull request. It is split so each is reviewable and green alone: first `@beep/gate-report` complete (schemas, reducer, classifiers, counts, signature, folding table, dispatch cells and the law tests that need no service), then the record and gate-run libraries, the Vitest adapter and the `test` and `check` wiring for `@beep/glob`. P4, P5 and the closeout follow as the third. The packet allows three open pull requests; these are sequential.
