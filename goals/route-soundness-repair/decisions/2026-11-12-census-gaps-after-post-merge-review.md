---
title: "Post-merge review: census covers bare-string and exploration reads; COVE-02 judges a baseless run at HEAD"
date: 2026-11-12
kind: checkpoint
lane: "fix/rout-03-census-gaps"
reversal: "Supersede with a later checkpoint; to undo, drop the four new consumer rows and the fallback comparison base."
---

A post-merge review of the slice 1 and slice 2 PRs found four gaps, all fixed in one PR. Scope call: ROUT-03 covers exploration packets as well as goal packets, because a test that reads a tracked exploration fixture is the same consumer class; the census now scans both roots. (1) The census missed bare-string reads such as the ci-runner-security test joining the repository root with the speed-loop runner-burst directory; a quoted-literal read shape now runs over test code, counts only literals that resolve to tracked files, skips classifier tables, drops a literal naming a single packet document, and lists each synthetic temp-root literal as an exclusion with its reason. (2) Tests reading the ciops s6 ABox and journal, the s4 run4-fleet corpus and the legal-ontology-landscape asset manifest stayed docs-only; four consumer rows join codeRoots for them and the runner-burst directory. (3) A bare coverage run with no origin/main merge base and TURBO_SCM_BASE unset now judges against the baseline committed at HEAD. (4) The COVE-02 fixture now asserts the withheld-lowering line, the fallback case, and a pinned comparison that passes once the package measures at its floor. Each fix is red on the code before it.
Source: post-merge review findings of 2026-11-12; goal-data-consumer-census.test.ts and quality-tasks.test.ts.
