---
title: "Slice 5 merged; slice 11 (ROUT-05 slice 2) in review: failed jobs keep their steps, uncharged reds become unknown"
date: 2026-11-13
kind: checkpoint
lane: "feat/certainty-rout-05-step-outcomes"
reversal: "Delete this checkpoint so the slice-5 checkpoint is the latest PLAN status note, and revert the slice-11 commit."
---

Slice 5 (SCHE-09 slice 1) merged as #3227. Slice 6 (MEAS-07, #3228) is in review. Slice 11 adds optional `steps` and `tasks` keys to the v1 route corpus row and an origin for every failed job's red; aggregate, setup and harness reds are charged to no lane and reported as unknown in the replay (decision `step-classes-and-red-origins`). The old 2026-09-01..10-30 receipt still replays to 242 skipped lane runs and 0 skipped reds. Next in this wave: PERIL-11 slice 1 (slice 7, after slice 6) and MEAS-03 (slice 10); the 2026-10-31..now capture (slice 12) starts once slice 11 merges, and is the first corpus whose failed jobs carry steps.
