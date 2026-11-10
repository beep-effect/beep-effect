---
title: "The reparse check compares every other node by kind and text"
date: 2026-11-10
lane: "agent-memory-store-p1"
reversal: "Add a nesting comparison by decision file citing a replay where a stable check let a projected edit re-parent a node"
---

The reparse check (scoreboard design item 5) is checkReplacement in packages/tooling/library/agent-memory-store/src/MarkdownPartition.parser.ts. It takes the base partition and a NodeReplacement naming a run of node indices [start, end) and its new text, so one call covers replacing one node (end = start + 1), inserting between nodes (end = start) and deleting (empty text). It partitions the edited text once and matches the longest prefix and suffix of nodes by kind and text; nodes outside the run that fall in neither are the disturbed indices, and the check is stable when there are none. The result returns the edited partition and the region of edited nodes covering the replacement, so the projector reuses them instead of partitioning twice. A run outside the partition fails with the typed NodeReplacementOutOfRangeError; the partition itself never fails. The comparison is by kind and text, not by nesting: deleting a list item first line can re-parent its indented continuation under the previous item while every other node keeps its text and kind, and that reports stable. Rejected: comparing ranges (every node after an edit shifts) and comparing tree paths (the projector holds node texts from the log, not trees).
