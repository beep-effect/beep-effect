---
title: Pathological budgets scale by a same-path calibration, and a case over budget is an engine defect
date: 2026-11-26
reversal: Assert each vendored timeoutMs as raw wall clock, or drop the budget assertion and keep only termination and output checks.
governs:
  - test/e2e/pathological.e2e.test.ts#CALIBRATION_INPUT
  - test/e2e/pathological.e2e.test.ts#UNINSTRUMENTED_CALIBRATION_MS
  - test/e2e/pathological.e2e.test.ts#speedFactor
enforcedBy: []
---

Each vendored cmark budget is multiplied by `speedFactor`: one warm-up parse of `CALIBRATION_INPUT` (so first-call compilation does not dominate), one timed parse, divided by its 93 ms uninstrumented cost and clamped to 1-40. The input is the gfm "tables" case at 1/30 scale, so it inflates with the suite's dominant cost, node materialization; the earlier `[a](b` input cost about 3 ms once the destination scan was capped and calibrated nothing.

Reason: v8 coverage triples a materialization-heavy parse (calibration 93 ms clean vs about 290 ms, "tables" 2.8 s vs 8.7 s) and inflates tight engine loops about 9x (18x for the pre-cap destination scan). Quadratic blowup still outruns any constant factor, and the destination-work counter checks linearity independently of these budgets.

A case over its scaled budget is an engine defect, never a budget to raise. Keeping the suite found six: a quadratic link-close deactivation walk over never-popped image openers (now an active-opener count), raw HTML rescanning to end of input for `-->` (34 s to 0.1 s with a not-past-here memo), the code-span closer walk (now a backtick run index), a recursive image-alt flattening RangeError, the uncapped link-destination scan (cmark's MAX_LINK_DEST_PARENS; commonmark.js 0.31.2 shares the quadratic), and `Table.make` rebuilding every row through class-typed children (7.4 s to 2.8 s via one-member unions).

Rejected: raw milliseconds, which pass only without coverage and go red in CI for a reason unrelated to the parser; asserting no budget, which gives up the linear-time guarantee.
