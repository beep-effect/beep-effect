---
title: "Migration takes main's merge-queue-lab closeout (#3169) instead of adopting #3112"
date: 2026-11-13
lane: "feat/goal-closeout-hosted-verification"
reversal: "Run goals set-status merge-queue-lab active, then goals set-status merge-queue-lab completed-retained --final-pr 3112 --adopt-merged, and refresh."
---

The §5 table planned to adopt merge-queue-lab's legacy proposal for #3112. Since base `7a462a27d4f`, `main` closed the packet by the old route: #3146 re-finaled it and #3169 committed `closeout` naming #3169 under the operator ruling in `goals/merge-queue-lab/decisions/2026-11-13-operator-ruling-close-in-one-packet-state-pr.md`, with #3112 and #3146 as `supporting`. Adopting #3112 in this lane would bind a superseded final and conflict with `main` on the manifest, README, SPEC.md and PLAN.md.

S9 instead restores `goals/merge-queue-lab/` from `origin/main` (`ae6ab98b3c6`) byte for byte, so the S12 merge of `origin/main` is clean for that packet and the `proposedCloseout` census passes in the lane. Under the hosted-only rules, `goals completion refresh --slug merge-queue-lab` printed `verified` for #3169 (6 green and 9 skipped required contexts plus 0 of 0 threads).
