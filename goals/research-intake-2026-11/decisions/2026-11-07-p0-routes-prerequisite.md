---
title: "P0: research-library-routes is unmerged; routes run first, mine commands build in parallel"
date: 2026-11-07
kind: checkpoint
lane: "feat/research-intake-2026-11"
reversal: "If routes lands a different CLI surface, re-plan acquisition against goals/research-library-routes/history/intake-handoff.md"
---

The SPEC constraint requires research-library-routes merged before the intake runs. On 2026-11-06 that goal was active with every phase pending and no lane, branch or PR. The orchestrating session launched it as its own Opus 5.5 medium lane (T3 delegate, worktree isolation) with a handoff file naming the CLI surface. Hop-0 census confirmed paths and counts only: the Nov-5 aggregation holds 332 files (5.5 GB; 143 md, 57 json, 39 vtt, 38 mkv, 3 pdf) under the operator research root; the library root is the beep-effect collection beside it with intakes 2026-10-06 and 2026-10-14. No snapshot is frozen and nothing is acquired until routes merges, because the Box nightlies are part of hop 0 and arrive through the Box route. The mine commands (T1/T2/T3 runners) do not depend on the routes and are built now in this lane.
