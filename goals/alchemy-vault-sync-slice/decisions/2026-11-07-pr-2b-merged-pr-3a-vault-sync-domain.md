---
title: "PR 2b merged; PR 3a vault-sync domain"
date: 2026-11-07
kind: checkpoint
lane: "vault-sync-domain worktree"
reversal: "Revert the PR 3a squash commit; no product data uses the new aggregates yet"
---

PR 2b (#2863) merged 2026-11-07 as 97a7bb87f4: views, projections, streams, Backfill catch-up, upcasting at read, the Cluster workflow engine, real-Postgres integration, and an explicit-clock InMemory conformance suite. PR 3a lands the vault-sync domain: SyncDestination (with the folded cursor), DestinationNameReservation, SyncItem, SyncOperation (stable ids, lease with expiry and retry Deadlines), SyncConflict with a per-destination remote-event registry; the VaultSyncStatus, OpenConflicts, DestinationList and OperationQueue Views; the BoxMirror ExternalSystem contract; eight Policies. Tests run on Domain.InMemory and the @beep/alchemy-postgres PGlite layer. The saga, projections into the legacy tables, genesis, cutover and the Api follow in PR 3b and 3c.
