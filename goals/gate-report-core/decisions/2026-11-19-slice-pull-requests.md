---
title: "The goal lands as three sequential pull requests"
date: 2026-11-19
lane: "feat/gate-report-core"
reversal: "Open one pull request for P1 through P3 as the plan first said."
---

The plan lands P1 through P3 as one pull request. It is split so each is reviewable and green alone: first `@beep/gate-report` complete (schemas, reducer, classifiers, counts, signature, folding table, dispatch cells and the law tests that need no service), then the record and gate-run libraries, then the Vitest adapter with the `test` and `check` wiring, the gate queries and the closeout. The port review ran before the third opened and its findings were fixed in the pull request that owns each piece of code, so a fourth pull request for documents alone was dropped. The wiring rewrites every package manifest, so it stays apart from the libraries. The packet allows three open pull requests; these are sequential.
