---
title: "Start each unit bin's heaviest packages first and split the 449 s repo-cli test file"
date: 2026-11-09
lane: "perf/unit-bins-fold-main-run"
reversal: "Remove the startFirst lists from the unit bins in CiLanePartitions.ts and the ciLaneStartOrder call in CiCoverage.ts; steps then run in name order again. Undo the split by moving the tests of research-library-evidence.test.ts back into research-library-views.test.ts and pruning the plan."
---

Main run 42677073526, the first on the 11/12/7 layout, ran every Test Unit shard under ten minutes except unit-b at 10.2 min; repo-cli-1 ran 9.8 min there and over ten on two of the next four pull-request runs. All seven bins had the same serial sum (582 s), so the repack was not the cause. The lane runs two package steps at a time in name order, and unit-b's 309 s package (`@beep/repo-ai-metrics`) started 162 s in and then ran alone: the bin body took 471 s against 265 to 448 s for its siblings.

- A unit bin row now carries `startFirst`: its packages measured at 30 s or more, heaviest first. The lane starts those before the rest (`ciLaneStartOrder`), so a bin's body stays near the larger of its heaviest package and half its serial sum.
- `beep ci partitions rebalance --write` prints each bin's `startFirst` list with the measured seconds.
- `test/research-library-views.test.ts` was one 434 to 449 s file, so `repo-cli-1` held it alone and ran 9.0 to 10.7 min over five runs. The file is split at the test that halves its measured time: `research-library-views.test.ts` keeps the view and integrity tests, `research-library-evidence.test.ts` takes the evidence-binding and correction tests, and `test/support/ResearchLibraryViews.ts` holds the shared fixture. The plan seeds the halves at 221 s and 228 s, the old file's worst measurement divided by the per-test seconds of main run 42677073526, until a green run measures them.
- The bins and both shard plans are refolded over six green runs (five on PR #3007 and main run 42677073526): repo-cli eleven shards of 321 s, law-practice-server twelve of 376 s after pruning two deleted files, unit bins 593 to 594 s.
- Rejected: an eighth unit bin. It lowers the serial sums but leaves the start order to chance, which is what made unit-b slow.

The rerun of PR #3007's last head (42669948388) could not be folded: GitHub returns 502 for its jobs listing.
