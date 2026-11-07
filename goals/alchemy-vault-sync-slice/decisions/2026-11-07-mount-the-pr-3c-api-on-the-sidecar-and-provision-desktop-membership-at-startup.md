---
title: "Mount the PR 3c Api on the sidecar and provision desktop membership at startup"
date: 2026-11-07
lane: "goals/vault-sync-cutover"
reversal: "Apply drizzle/20261107120500_shared_membership/down.sql, restore VaultSyncHandlersLive over a Model-backed engine port, and drop the transport mount from server/main.ts"
---

With PR 3c content-final, the cutover lane flips the desktop: `RuntimeLive` and `RuntimeTest` serve `VaultSyncRpcsApiLive` (the four existing RPCs, legacy wire unchanged) over `VaultSyncSessionLive`, the sidecar channel adapter, the desktop binding and live membership, on the hosted `VaultSyncPassModel`. `server/main.ts` mounts `makeVaultSyncTransportLayer` (HTTP, `/vault-sync/rpc`, MCP) beside the ontology MCP when a launch token is configured; the handlers and the transport share one host value, so memoization builds a single Model on the sidecar PGlite. The interim Model-backed `VaultSyncEngine` port, its inputs and `VaultSyncOrchestrator` are deleted in the same change; this supersedes the engine-port decision of the same day.

`shared_membership` is added through db-admin's drizzle tooling (`20261107120500_shared_membership`), which also feeds the desktop migration bundle. drizzle-kit is forward-only, so the folder carries a `down.sql` that drops the table and its journal row; `SharedMembershipMigration.pglite.test.ts` proves up, down and up again. The owner seed is not part of the shared migration (server Postgres replays the same folder): the desktop bootstrap calls `ensureVaultSyncOwnerMembership(1, 1)` once per start, with a deterministic public id, so restarts add nothing and a soft-deleted row stays revoked. The bootstrap also registers workspace 1's `legacy-box-workspace-1` destination idempotently, because the Api maps a workspace to its destination through DestinationList and a fresh workspace has none.

A pass now reads its vault root on every call through `VaultSyncRootFromWorkspaceLive` (destination → workspace → authorized workspace vault configuration), replacing the root registry that only the deleted engine populated. If admission refuses, the vault-sync handlers fall back to maintenance responses and the transport is not mounted; the rest of the sidecar keeps serving.

Behaviour change at the flip: TriggerVaultSync and the forced probe answer at acceptance; the pass completes in its saga. The panel invalidates its status and conflict keys when the RPC returns, so counts reflect the pass only on the next read.
