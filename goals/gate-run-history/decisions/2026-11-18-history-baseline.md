---
title: "Labels compare against the lane's own runs and main's hosted results"
date: 2026-11-18
lane: "explore/agent-verification-output"
reversal: "Drop the main baseline and label from lane history alone"
---

Every run is recorded with its branch, and the series key is gate, subject, item key and branch. A failure is labelled against two series: the lane's own earlier local runs, and main's hosted report at the lane's merge base (local runs on main never serve). Output distinguishes a failure introduced on the lane from one already red on main, and a red on one lane never relabels another. Upstream's one history shared by every worktree and branch is replaced by this partition. Ruling: explorations/agent-verification-output/DECISIONS.md, entry `history-baseline`.
