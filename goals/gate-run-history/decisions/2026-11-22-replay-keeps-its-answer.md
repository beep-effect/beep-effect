---
title: "A run keeps the answer it rendered, and its id is kept for good"
date: 2026-11-22
reversal: "Drop gate_history_ingested, recompute the answer of a replay from the retained window, and judge a replay by the run row alone."
---

A replay must render what the original run rendered, but the window and the run retention drop the evidence that answer came from. Schema version 2 adds gate_history_ingested, one row per run id ever ingested, with the branch and the labels, delta and baseline line the console showed. A replay on the same branch is answered with that row; on another branch it is answered from that branch, so AC-H1 still holds. A run whose console had no answer (a read past its deadline) keeps the answer read at ingest, or none, and is then answered afresh.

The same table decides a replay, so a run id ingested before adds nothing even after its run row was pruned. The table is not pruned: a row is the run id, the branch and the labels of the items that had one, typically under a kilobyte, so ten thousand runs take under ten megabytes. Version 1 stores are migrated from the run ids their rows still hold, with no kept answer.
