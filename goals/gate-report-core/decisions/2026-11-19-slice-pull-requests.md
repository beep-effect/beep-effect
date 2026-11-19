---
title: "The goal lands as four sequential pull requests"
date: 2026-11-19
lane: "feat/gate-report-core"
reversal: "Open one pull request for P1 through P3 as the plan first said."
---

The plan lands P1 through P3 as one pull request. It is split so each is reviewable and green alone: first `@beep/gate-report` complete (schemas, reducer, classifiers, counts, signature, folding table, dispatch cells and the law tests that need no service), then the record and gate-run libraries, then the Vitest adapter with the `test` and `check` wiring and the gate queries, then the port review and the closeout. The wiring rewrites every package manifest, so it stays apart from the libraries. The packet allows three open pull requests; these are sequential.
