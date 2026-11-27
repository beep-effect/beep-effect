---
title: The vault sync pass waits longer than the driver delivery lease for a policy-created operation
date: 2026-11-26
reversal: Restore a 10-second awaitOperation timeout in VaultSyncPass.saga-handlers.ts.
governs:
  - src/aggregates/Sync/VaultSyncPass.saga-handlers.ts#VaultSyncPassLive
enforcedBy: []
---

awaitOperation waits up to 2 minutes for the operation the ItemOperations policy creates from the item's event. After a host crash that delivery can stay leased to the dead host until the driver lease lapses (30 seconds by default), and the wait must outlast it or a resumed pass dies before the policy runs.
The choice is recorded in goals/alchemy-vault-sync-slice/decisions/2026-11-07-ep44-outlast-the-delivery-lease-when-the-vault-sync-pass-waits-for-a-policy-created-operation.md.
Rejected: the 10-second wait, which killed a resumed pass under load although the delivery recovers by itself once the lease lapses.
