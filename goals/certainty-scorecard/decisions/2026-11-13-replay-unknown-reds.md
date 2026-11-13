---
title: "The route replay marks recall uncertain when a skipping head has a failed unmapped job"
date: 2026-11-13
lane: "fix/certainty-wave2-fixes"
reversal: "Drop unknownRedHeads, unknownRedJobNames and recallCertain from RouteReplay; recall then ignores failed jobs no rule maps."
---

A post-merge review of #3141 found that `beep ci route replay` judged skipped reds only through jobs that map to a lane. A failed job whose name no rule maps (class `unknown`) never entered the red set. If the build or check job were renamed, a head whose route skipped check and whose renamed check job failed would leave `skippedReds` at 0, and recall would print 1 with no marker. `RouteReplay` now carries three fields:
- `unknownRedHeads`: heads that skipped at least one lane and have a failed `unknown`-class job.
- `unknownRedJobNames`: those jobs' names, each listed once.
- `recallCertain`: false whenever the count is above zero; recall is then an upper bound, and the text output says so.

Only skipping heads count, because a head that skipped nothing cannot hide a skipped red. The same review found that two assertions in the ROUT-05 fixture test held by construction, since each attributed job has exactly one class. They are replaced by literal per-class totals re-derived from the fixture's raw timestamps (20,200,000 ms total, 240,000 ms support, 0 unknown), which is the guard. The 2026-09-01..10-30 corpus has failed jobs on retired lanes (Knip, Shadcn Lint), so its replay may now report recall as uncertain; it was not re-run here.
