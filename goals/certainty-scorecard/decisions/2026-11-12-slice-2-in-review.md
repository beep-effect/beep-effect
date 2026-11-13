---
title: "Slice 1 merged; slice 2 (ROUT-05 slice 1) in review"
date: 2026-11-12
kind: checkpoint
lane: "fix/rout-05-partition-map"
reversal: "Delete this checkpoint and restore the slice-1 checkpoint as the latest PLAN status note."
---

Slice 1 (MEAS-01 slice 1 with MEAS-04) merged as #3118; its coverage rows were fixed by #3121 (decision `slice-1-coverage-reds`). Slice 2 maps every hosted job to a lane, a support job or unknown, and adds the conservation census `jobMinutes` to `beep ci route census` (decision `job-attribution-classes`). Next startable: MEAS-02 (slice 3) and the certainty-nightly workflow (slice 4); ROUT-05 slice 2 (PLAN slice 11) and the lane-id map consolidation (slice 14) wait on this slice.
