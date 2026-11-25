---
title: Session and turn ids are content-addressed; an ingest run is lineage, never identity
date: 2026-11-23
reversal: Put the ingest run id back into the session and turn row keys and insert turns with INSERT OR REPLACE.
governs:
  - src/derived-storage.ts#upsertSessionAndTurns
  - src/derived-storage.ts#currentAgentSessionIdExpression
  - src/derived-storage.ts#legacyAgentSessionIdMigrationStatements
enforcedBy: []
---

`turn_id` hashes [sourceKind, sourcePathHash, lineNumber, rawEventHash]; the session id hashes [sourceKind, sourcePathHash].
Turns are INSERT OR IGNORE, so a turn keeps its first-seen run id and session pointer.
The session key is therefore the file prefix of the turn key and nothing more: `source_role`
comes from transcript content and can flip later; in the key, a flip would mint a second
session row while existing turns point at the first. Out of the key, a flip rewrites the column.
Existing stores never self-heal, so `ai-metrics-agent-session-id-v2` repoints turns while the
per-run rows exist, then drops the per-run duplicates (keeping the greatest legacy digest
without reading `ai_metrics_ingest_runs`, which retention may have pruned), then rekeys.
Rejected: the run id in either key, which minted one row per run (5.43M turn rows over
~516K distinct raw events across 1,222 runs) and scattered a session's turns.
Rejected: INSERT OR REPLACE, which rewrites the run id and re-exports every seen turn.
