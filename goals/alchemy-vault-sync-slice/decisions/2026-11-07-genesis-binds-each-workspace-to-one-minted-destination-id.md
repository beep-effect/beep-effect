---
title: "Genesis binds each workspace to one minted destination id"
date: 2026-11-07
lane: "goals/vs-cutover"
reversal: "Drop documents_sync_destination_binding and restore a derived workspace destination id in SyncGenesis.service.ts; any store already imported keeps its minted ids"
---

PII audit F3 requires genesis to mint opaque destination ids. The earlier lane derived legacy-box-workspace-<n> from the workspace id, and the bootstrap used the same derivation. A minted id must still be the same on every call: a genesis re-run after a crash in migrating, the desktop bootstrap and the Model engine all have to agree. workspaceDestinationId therefore mints a documents_sync_destination_<cuid-shaped random> id once and records it in documents_sync_destination_binding (workspace_id primary key, destination_id unique). Every later call reads that binding. The table is cutover state, created idempotently at runtime like the epoch and D14 identity tables, and is outside the writer fence. Minting uses Clock and Random through makeDestinationId, not mintDestinationId, so neither host needs a CuidState layer. Uniqueness comes from about 62 random bits plus the unique constraint.
