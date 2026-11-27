---
title: Genesis keeps legacy free text in the imported row and gives aggregate state closed values
date: 2026-11-26
reversal: Carry the legacy idempotency_key text into OperationRecord.input.idempotencyKey in SyncGenesis.service.ts and widen the domain key back to free text.
governs:
  - src/aggregates/Sync/SyncGenesis.service.ts#operationRecordInput
  - src/aggregates/Sync/LegacySync.projection.ts#LegacySyncProjections
enforcedBy: []
---

An imported operation's legacy idempotency_key text stays in the genesis event's row, which the legacy projection writes back verbatim; the state takes the operation's own public id, the only key QueueOperation accepts, so an imported operation queues and retargets like a live one.
The projection writes idempotency_key only when it creates the row, so an imported row keeps its legacy key text through later live events and a live row keeps the operation id it was queued under.
The choice is recorded in goals/alchemy-vault-sync-slice/decisions/2026-11-07-map-legacy-free-text-sync-reasons-losslessly-at-genesis.md.
Rejected: keeping the legacy key text in aggregate state, which QueueOperation refuses, so an imported operation could never be queued again.
