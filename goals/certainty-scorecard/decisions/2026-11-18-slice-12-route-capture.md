---
title: "Slice 12: route corpus captured through 2026-11-17 under the reserve"
date: 2026-11-18
kind: checkpoint
lane: "t3/certainty-scorecard-route-capture-2026-10-31"
reversal: "Delete this checkpoint so the slice-9 checkpoint is the latest PLAN status note, and revert the slice-12 PR."
---

Slice 12 (ROUT-05 slice 3) is built. `beep ci route capture` holds each GitHub call while the capture identity's `core` bucket is below `github-budget-ledger`'s 15% reserve, counts every response, and reads a run's jobs in pages of 30 after a 502 (decision `route-capture-reserve-gated`). The corpus receipt now covers 2026-09-01..2026-11-17: 10,435 runs, sha256 `d8328a6dd060…`, 4,107 runs beyond the old receipt, captured in five checkpointed bursts for 8,282 counted requests. The first corpus whose failed jobs carry steps: 4,439 in the new window. Census conservation holds: lane, support and unknown jobs and minutes sum to the totals (315,252 jobs). Unknown is 2.4% of job time overall and 0.84% on the new window, all retired `Shadcn Lint` (folded into Repo Sanity by #3117) and two unexpanded conditional names on skipped jobs. With slice 12, ROUT-05 is landed except the per-task outcomes of slice 11b.
