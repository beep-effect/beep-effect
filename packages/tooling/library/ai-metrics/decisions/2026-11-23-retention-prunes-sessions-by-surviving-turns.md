---
title: Retention prunes a session row only when no turn and no ingest run still points at it
date: 2026-11-23
reversal: Delete session rows WHERE ingest_run_id IN the prune set, alongside the other run-keyed tables.
governs:
  - src/retention.ts#deleteIngestRunRows
enforcedBy: []
---

Sessions are deleted last, after the ingest runs, when no turn references the row and the run
it names no longer exists. That also sweeps rows an earlier prune leaked.
Rejected: pruning by the session's `ingest_run_id`. Session rows are content-addressed and
upserted, so the column names the run that last saw the transcript; the row would go while
turns from other runs survive, and the exporter's INNER JOIN would silently drop those turns.
Rejected: scoping to the prune set. A row kept for its remaining turns is tagged with a pruned
run, so once its last turn goes no predicate matches it again and the empty row pins its agent
task alive through the task GC forever.
