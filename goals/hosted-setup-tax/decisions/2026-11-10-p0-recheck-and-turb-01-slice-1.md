---
title: "P0 lever re-check at 5e09d90a6da; TURB-01 slice 1 implemented"
date: 2026-11-10
kind: checkpoint
lane: "feat/turb-01-standards-coverage-owners"
reversal: "Revert this PR; the packet returns to the c90929b1ff1 lever check."
---

Lever table re-checked against origin/main 5e09d90a6da: #3041 merged (no open PR on shared files remains), #3056 split Property Laws into four slices (recorded as a decision; TEST-01 row corrected). TURB-01's cited lines (`CoverageScope.ts:76-98`, `:772`) were still accurate before this slice. TURB-01 slice 1 lands in this PR: owner rows for six generated standards paths, the reader scan and its live drift check, and an in-repo first-parent replay (67 of 727 commits shrink, 0 violations). P0's scorecard re-baseline still waits on certainty-scorecard. Next startable slices: 2 (PERIH-02 and PERIL-04) and 3 (TEST-01 oracle census); slice 4 follows slice 3.
