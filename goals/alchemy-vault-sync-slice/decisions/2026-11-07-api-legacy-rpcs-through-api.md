---
title: "Desktop vault-sync RPCs keep their wire and run through the Api"
date: 2026-11-07
lane: "goals/vault-sync-api"
reversal: "Keep VaultSyncHandlersLive in RuntimeLive; VaultSyncRpcsApiLive is a drop-in layer swap"
---

VaultSyncRpcsApiLive implements the four VaultSyncRpcs over the protected Api client with unchanged payloads and DTOs. Workspace maps to its destination through the authorized DestinationList View. Trigger and forceProbe record RequestVaultSync and ProbeDestination and answer with the status at acceptance, not after the pass; the panel's existing invalidation re-reads status. forceProbe also refreshes the probe cache for the answer. Conflict rows come from the legacy SQL read model the slice projects, restricted to public ids the authorized OpenConflicts View returns; review resolves the numeric id through those rows, sends ReviewConflict with a per-conflict heal operation id, and never writes legacy tables. Mounting it in RuntimeLive is the single-writer flip and belongs to the cutover activation, which also hosts the model on the sidecar PGlite.
