---
title: "Reverse an admitted store from the current projection, not the pre-cutover backup"
date: 2026-11-07
lane: "goals/vault-sync-cutover"
reversal: "Replace reverseSyncCutover with a restore of the offline backup plus a replay of post-admission events into legacy rows, keeping the same refusal preconditions"
---

Research/07 section 7 names two reversal cases. Before admission, `restoreSyncTables` restores the immutable offline backup. After admission that backup is stale, so `reverseSyncCutover` uses the projection-to-legacy route: the four tables already hold the projected state of every accepted event.

Procedure, with the Model runtime and workers stopped: refuse while any Box intent receipt is unsettled (`uncertain-remote-outcome`) or a LegacySync projection has pending deliveries or unprocessed inputs (`projection-behind`); record the event high-water count; in one cutover transaction snapshot the four tables to `*_reversal_backup` and verify a zero diff; return leased operations to queued with a row-version bump, recording their ids (the leases belong to workflows that will never resume); move each table sequence beyond every id in the table and in the D14 allocator; record the reversal receipt and the `legacy` epoch with the next generation.

The event and workflow store stays in place, read-only: the fence refuses the Model marker and `ensureSyncCutover` refuses to resume a reversed store, so a recutover needs a fresh import. Box uploads are never compensated. Destination name reservations and lease metadata have no legacy representation and remain only in the retained event store.

Test: `SyncCutoverAdmission.pglite.test.ts` admits a drizzle-migrated store, writes and leases through the Model, proves the uncertain-intent refusal, reverses, then shows the live tables equal the snapshot except the three recorded lease-rollback columns, the legacy writer inserts and updates again with an id beyond every Model id, and the Model can neither resume nor write.
