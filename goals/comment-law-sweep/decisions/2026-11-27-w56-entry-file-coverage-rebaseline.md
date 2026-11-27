---
title: "Re-baseline coverage for entry-file name carriers in w56"
date: 2026-11-27
lane: "goals/comment-law-sweep-w56"
pullRequest: 3635
reversal: "Inline 8787 and the checkout-root URL back into api-docs and lane-cockpit main.ts and restore their previous coverage rows."
---

Comment-law w56 carried two deleted reasons as module-level names in entry files that no test imports: `portWhenPortlessIsOff` in `apps/labs/api-docs/src/main.ts` and `checkoutRootFromSrcMain` in `apps/labs/lane-cockpit/src/main.ts`. Both files measure 0% on main, so each name adds one uncovered line and statement, and the package percentages fall because the deleted comment lines also shrank the denominator. No covered line became uncovered.

Reason: a test that imports an entry file starts its server or TUI, so covering these lines would add a test that earns nothing (operator ruling 2026-11-09: re-adjust the ratchet rather than keep or add such a test). The two package totals and the two `main.ts` rows in `standards/coverage.regression-baseline.jsonc` take the hosted measurement of run 45983710972.

Rejected: inlining the literals again, which drops the carried reasons; a test that imports either entry file.
