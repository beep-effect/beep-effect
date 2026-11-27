---
title: Genesis mints a destination binding id from Clock and Random, not from a CUID host service
date: 2026-11-26
reversal: Mint the binding id in SyncGenesis.service.ts with mintDestinationId and provide a CuidState layer to every host that runs genesis.
governs:
  - src/aggregates/Sync/SyncGenesis.service.ts#mintBindingId
enforcedBy: []
---

mintBindingId builds a CUID-shaped token from Clock and Random and wraps it with makeDestinationId, so no host that runs genesis needs a CuidState layer. Uniqueness comes from about 62 random bits plus the UNIQUE constraint on documents_sync_destination_binding.
The choice is recorded in goals/alchemy-vault-sync-slice/decisions/2026-11-07-genesis-binds-each-workspace-to-one-minted-destination-id.md.
Rejected: mintDestinationId, which needs a CuidState layer on the desktop bootstrap and on the Model engine.
