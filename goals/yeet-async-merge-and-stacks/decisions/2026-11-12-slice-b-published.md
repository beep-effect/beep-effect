---
title: "Slice B: head-move classifier and rewrite carry published"
date: 2026-11-12
kind: checkpoint
lane: "feat/yeet-rewrite-stable-proof"
reversal: "Revert the slice B PR; every head move restarts the window and voids the receipt again."
---

Slice B adds YeetHeadMoveClassifier (HeadMove.ts), the repository-activity read and the pull base sha in GithubRest, the review-window carry (ReviewWindow.ts, seams in GhOps, MergeGate and GateTable) and the receipt carry in yeet ready (FinalCheckRefresh.ts, ReadyGate.ts). On the recorded #3050/#3051 heads all six rewrite pairs classify unchanged and the stale-base, retarget and layer-2-versus-layer-3 counterexamples classify changed. The carried #3050 window anchors on ready at 02:25:19Z and elapses at 02:45:19Z instead of restarting at 02:54:20Z. yeet gh pr status and merge now read the shared window and honour BEEP_YEET_REVIEW_WINDOW. Next: the slice B PR merges; then slice C.
