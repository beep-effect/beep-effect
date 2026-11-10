---
title: "Per-SHA main verdicts are handed to merge-queue-activation; this goal provides the layout and the replay"
date: 2026-11-09
reversal: "A decision file here restoring the per-SHA slice, after a ruling that the merge queue will not carry the verdict (D28's reversal)."
---

The operator's `verdict-placement` ruling makes the merge group the per-commit main verdict, one run per commit placed before the merge, and folds "Per-SHA main groups" into the gated `merge-queue-activation` candidate of `explorations/github-merge-queue`, after D7's throughput layout lands. D28 applies it to this goal: the per-SHA concurrency slice is removed from PLAN.md and the HOST-01 per-SHA stage is marked handed off in the lever table. `ci/main-verdict` now means the landed throughput layout, which `merge-queue-activation`'s gate waits on; the merge-timestamp replay, published as input for that candidate's owner whether or not its gate names it (D28); and the interim main verdict rate after the layout and re-dispatch. The plan's 95% bar stays the bar; the remaining gap is recorded as `merge-queue-activation`'s. Rejected: keeping per-SHA groups here as a fallback slice (built against a ruling; two full runs per commit).
Source: exploration `explorations/ten-minute-certainty/DECISIONS.md` (D28) and `explorations/github-merge-queue/DECISIONS.md` (`verdict-placement`).
