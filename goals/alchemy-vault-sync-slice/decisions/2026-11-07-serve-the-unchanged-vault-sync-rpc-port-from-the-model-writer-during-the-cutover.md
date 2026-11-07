---
title: "Serve the unchanged vault-sync RPC port from the Model writer during the cutover"
date: 2026-11-07
lane: "goals/vault-sync-cutover"
reversal: "When PR 3c moves the RPC callers onto the Model Api, delete makeVaultSyncModelEngine and the VaultSyncEngine port in that PR; the Model, projections and read model stay"
---

D7 requires the drizzle writer to disappear in the same change that makes the Model the writer, while PR 3c separately owns the RPC and HTTP surface. This change therefore keeps the `VaultSyncEngine` port and `VaultSyncRpcs` byte-for-byte and re-implements the port over the Model (`makeVaultSyncModelEngine`):

- `syncOnce` registers the workspace's `legacy-box-workspace-<n>` destination on first use (the same id genesis derives), records the canonical vault root in `documents_sync_destination_root`, runs one durable `VaultSyncPass` and waits for the LegacySync projections before reading status, so callers see post-pass state as before.
- Reads (`status`, `listOpenConflicts`) come from `LegacySyncReadModel`, a read-only query service over the four projected tables using the legacy row decoders, so every reader keeps its entities and D14 numeric ids.
- `markConflictReviewed` resolves the numeric conflict id through its projected row, refuses another workspace's id, sends `ReviewConflict` with a deterministic heal operation id and no correction, and waits for the projected review.

The four repository ports, their drizzle and in-memory implementations, the legacy engine and its reconcile/push/drift/review modules are deleted. The vault root lives in SQL rather than events (no absolute paths in events or workflow results) so a resumed pass reads the same root after a restart. If startup admission refuses, the engine serves reads and refuses writes with `VaultSyncWriterUnavailable` instead of crashing the sidecar.

Known narrowing: the legacy review requeued a corrective operation for remote move or rename conflicts; the Model review sends `correction: null` and relies on the ConflictReviews and ItemHealing policies to return the item to pending. PR 3c owns review corrections on the new Api.

Superseded the same day by `2026-11-07-mount-the-pr-3c-api-on-the-sidecar-and-provision-desktop-membership-at-startup.md`: the PR 3c Api now serves the RPCs and the engine port is deleted.
