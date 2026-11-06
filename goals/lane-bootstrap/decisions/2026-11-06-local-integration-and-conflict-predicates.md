---
title: "Add local integration and would-conflict predicates to the fleet view"
date: 2026-11-06
lane: "lane-bootstrap-worktrunk"
reversal: "Drop the two columns from worktree fleet and the drainable class falls back to the forge-backed mergedAtHead check alone."
---

Worktrunk computes two predicates per branch with no network: integrated (content already in the default branch via different history, checked with git merge-tree, cherry and patch-id) and would_conflict (a dry git merge-tree against the default branch); see research/worktrunk-evaluation.md, pattern 2. beep squash-merges every PR, so ancestry checks lie and the existing mergedAtHead verdict needs the forge. lane-bootstrap adds both predicates to beep worktree fleet rows; legacy-drain consumes integrated as an offline fallback for the drainable class and the base-conflict P0 inbox consumes would_conflict as an early signal. The forge check stays authoritative where it is available; the local predicates never alone authorize a deletion.
