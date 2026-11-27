---
title: "Slices 1b and 9 to 11 landed; slices 3 to 8 and 12 to 17 remain"
date: 2026-11-27
kind: checkpoint
lane: "docs/ci-goals-catchup-11-27"
reversal: "Delete this checkpoint"
---

TURB-01b (slice 1b, owner rows for the remaining no-owner fallback paths) merged on 2026-11-13 as #3255 (9fcc8eb412d). PERIH-04's CLI and workflow switch (slices 9 and 11) merged out of plan order in #3122 (eee4f58f460, decision `job-level-lane-relevance-and-security-sast-narrowing`). Slice 10's pin bump is satisfied by the later binary pins, the newest being #3592 (beep-ci-3d3f90096cd3); HOST-09's half of slice 10 waits on slice 8. Merged: 1, 1b, 2, 9, 10 and 11. Remaining: 3 to 8 and 12 to 17. Slice 7 can start now that the ROUT-05 corpus is on main (#3372); slices 13 and 15 wait on route-soundness-repair PERIH-10 and ROUT-07.
