/**
 * Desktop vault sync client atoms.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { chatProtocolLayerAtom } from "@beep/agents-client";
import { VaultSyncRpcs, VaultSyncWorkspacePayload } from "@beep/documents-use-cases/public";
import { Effect } from "effect";
import { Atom, AtomRpc, Reactivity } from "effect/unstable/reactivity";
import type { MarkVaultSyncConflictReviewedPayload } from "@beep/documents-use-cases/public";
import type * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";

class DesktopSyncClient extends AtomRpc.Service<DesktopSyncClient>()("DesktopSyncClient", {
  group: VaultSyncRpcs,
  protocol: (get) => get(chatProtocolLayerAtom),
}) {}

const vaultSyncStatusKey = (workspaceId: WorkspaceIdentity.WorkspaceId) => `vault-sync-status:${workspaceId}`;

const vaultSyncConflictsKey = (workspaceId: WorkspaceIdentity.WorkspaceId) => `vault-sync-conflicts:${workspaceId}`;

/**
 * Atom family that reads the workspace vault sync status over desktop RPC.
 *
 * Refreshes whenever a sync trigger or conflict review invalidates the
 * workspace's status reactivity key.
 *
 * @example
 * ```ts
 * import { DEFAULT_WORKSPACE_ID } from "@/intake/Intake.atoms"
 * import { vaultSyncStatusAtom } from "@/sync/Sync.atoms"
 *
 * console.log(vaultSyncStatusAtom(DEFAULT_WORKSPACE_ID))
 * ```
 *
 * @category state
 * @since 0.0.0
 */
export const vaultSyncStatusAtom = Atom.family((workspaceId: WorkspaceIdentity.WorkspaceId) =>
  DesktopSyncClient.query("GetVaultSyncStatus", VaultSyncWorkspacePayload.make({ workspaceId }), {
    reactivityKeys: [vaultSyncStatusKey(workspaceId)],
  })
);

/**
 * Atom family that lists the workspace's open vault sync drift records.
 *
 * @example
 * ```ts
 * import { DEFAULT_WORKSPACE_ID } from "@/intake/Intake.atoms"
 * import { vaultSyncConflictsAtom } from "@/sync/Sync.atoms"
 *
 * console.log(vaultSyncConflictsAtom(DEFAULT_WORKSPACE_ID))
 * ```
 *
 * @category state
 * @since 0.0.0
 */
export const vaultSyncConflictsAtom = Atom.family((workspaceId: WorkspaceIdentity.WorkspaceId) =>
  DesktopSyncClient.query("ListVaultSyncConflicts", VaultSyncWorkspacePayload.make({ workspaceId }), {
    reactivityKeys: [vaultSyncConflictsKey(workspaceId)],
  })
);

/**
 * Mutation atom that triggers one vault sync pass and refreshes the
 * workspace's status and conflict queries.
 *
 * @example
 * ```ts
 * import { triggerVaultSyncAtom } from "@/sync/Sync.atoms"
 *
 * console.log(triggerVaultSyncAtom)
 * ```
 *
 * @category state
 * @since 0.0.0
 */
export const triggerVaultSyncAtom = DesktopSyncClient.runtime.fn<WorkspaceIdentity.WorkspaceId>()(
  Effect.fn("triggerVaultSync")(function* (workspaceId) {
    const client = yield* DesktopSyncClient;
    return yield* Reactivity.mutation(client("TriggerVaultSync", VaultSyncWorkspacePayload.make({ workspaceId })), [
      vaultSyncStatusKey(workspaceId),
      vaultSyncConflictsKey(workspaceId),
    ]);
  })
);

/**
 * Mutation atom that marks one drift record as reviewed and refreshes the
 * workspace's conflict and status queries.
 *
 * @example
 * ```ts
 * import { markVaultSyncConflictReviewedAtom } from "@/sync/Sync.atoms"
 *
 * console.log(markVaultSyncConflictReviewedAtom)
 * ```
 *
 * @category state
 * @since 0.0.0
 */
export const markVaultSyncConflictReviewedAtom = DesktopSyncClient.runtime.fn<MarkVaultSyncConflictReviewedPayload>()(
  Effect.fn("markVaultSyncConflictReviewed")(function* (payload) {
    const client = yield* DesktopSyncClient;
    return yield* Reactivity.mutation(client("MarkVaultSyncConflictReviewed", payload), [
      vaultSyncConflictsKey(payload.workspaceId),
      vaultSyncStatusKey(payload.workspaceId),
    ]);
  })
);
