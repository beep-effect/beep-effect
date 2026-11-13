---
title: "Slice 6 merged; slice 10 (MEAS-03) reports terminations apart from reds"
date: 2026-11-13
kind: checkpoint
lane: "fix/certainty-meas-03-terminations"
reversal: "Delete this checkpoint so the slice-6 checkpoint is the latest PLAN status note, and revert the slice-10 PR."
---

Slice 6 (MEAS-07) merged as #3228. Slice 10 (MEAS-03) classes every economics attempt green, red or terminated in `packages/tooling/tool/cli/src/commands/Yeet/internal/Economics.ts`: a terminated attempt leaves `firstFailure.redAttempts` and its mixes, `attempts.*.classMix` reports the classes, `modeDurations` reports each run mode's elapsed p50 and p95 (final-check included), and a final-check moved-tree refusal is typed `refusal:moved-tree`. The report is `yeet-economics/v3` (decision `terminations-apart-from-reds`, which states the denominator before and after). The admission gate is `packages/tooling/tool/cli/test/yeet-economics-adjudicated.test.ts` over the committed journal `test/fixtures/yeet-economics/adjudicated-terminations.ndjson`, every attempt classified by hand with its reason. Other second- and third-wave slices run in their own lanes.
