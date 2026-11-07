---
title: "Genesis imports the desktop store in one pass, not in batches"
date: 2026-11-07
lane: "goals/vs-cutover"
reversal: "Page the four backup tables by numeric id and send each page's genesis commands before reading the next"
---

Genesis reads the four *_cutover_backup tables fully into one validated snapshot, then sends one genesis command per row. It is not paged. The desktop sidecar store is the only genesis target: one workspace, with item and operation rows in the thousands at most. The whole snapshot fits in memory, and the per-row commands are already crash-safe. Each command id is derived from the snapshot digest, so a re-run after a crash replays as receipts and adds no events. Batching would split the snapshot digest that names the import and add a resumable cursor, which costs more than it saves at this size. Revisit when a server Postgres store with many workspaces becomes a genesis target.
