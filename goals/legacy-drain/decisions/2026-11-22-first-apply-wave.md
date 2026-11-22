---
title: "First apply wave: 39 lanes removed, 10 stopped part-way and finished by hand"
date: 2026-11-22
kind: checkpoint
lane: "goals/legacy-drain-wave1"
reversal: "Branches are intact: git worktree add <path> <branch>; ignored material is under drain-bundles"
---

First apply wave, run 2026-11-22 (UTC) from a fresh lane on origin/main, run id cdee03a7-5b50-4ece-9391-57b409ab2943.

Dry run: 130 fleet checkouts, 2 legacy clones holding 59,737,757,811 apparent bytes, 49 lanes eligible, no clone eligible. The fleet was 352 checkouts and 9 legacy clones on 2026-11-13: the difference is an operator-requested seven-day cleanup by another session on 2026-11-14 (ledger rows `age-retired-20261113`), not this drain.

Checks made before applying, beyond the predicate: no file, git or transcript activity in any of the 49 since its grace start; none locked; no T3 thread bound to one. The first observation (2026-11-13T22:06Z) ran the pre-review predicate and the merged predicate first observed on 2026-11-15T10:41Z, so the registry's seven days rest on that activity check for the first day and a half.

Result: 39 removed, 10 stopped part-way. Every removed row has passing checks in the journal, 39 registry rows are `retired`, 22 preserved directories and 1 verified bundle exist, and none of 345 local branches is missing. Legacy clones after: 2, holding 59,325,156,131 apparent bytes (unchanged by lane removal). Reported reclaim was 189,988,333,612 apparent bytes; measured free space rose 26.2 GiB, because lanes hardlink their dependencies.

Defect 1: the ten part-way removals. `git worktree remove` ran under the Git kit's 30 second timeout and was killed on large lanes after deleting the gitfile; the prune then unregistered them. The journal says `refused` and the report said `Kept`; both are wrong. All 49 heads are reachable from a ref or the bundle, and every leftover file existed in an archive or preserved copy, so the ten remnants were removed by hand by exact path. Their registry rows still read `draining`.

Defect 2: the preservation rule treated every ignored directory but `secrets/`, `.secrets/` and `*.local` as regenerable. `.beep/` is not: it held QA evidence, audits and hand-written scripts. Found before the wave; 48 lanes were archived and byte-compared first (3,097,819,339 bytes under `drain-bundles/wave1-ignored-material/`).

Both are fixed in this PR: lane trees go through the inode-bound removal, an unfinished removal is journaled `partial`, locked lanes are refused, and ignored directories are preserved unless a build or install rewrites them.

Outcome: both remaining legacy clones are registered `legacy` and in use. `beep-effect` is the main checkout; `beep-effect0` hosts the active beep-refs-refresh timer.
