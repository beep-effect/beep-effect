/**
 * Desktop vault sync client atoms.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { chatProtocolLayerAtom } from "@beep/agents-client";
import { VaultSyncRpcs, VaultSyncWorkspacePayload } from "@beep/documents-use-cases/public";
import * as Effect from "effect/Effect";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRpc from "effect/reactivity/AtomRpc";
import * as Reactivity from "effect/reactivity/Reactivity";
import * as Stream from "effect/Stream";
import { professionalBrowserRuntime } from "@/runtime/ProfessionalAtomRuntime";
import type * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";

/**
 * Browser RPC client for the professional desktop vault-sync protocol.
 *
 * **Example** (Runtime function type check)
 *
 * ```ts
 * import { DesktopSyncClient } from "@/sync/Sync.atoms"
 *
 * console.log(typeof DesktopSyncClient.runtime.fn === "function") // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class DesktopSyncClient extends AtomRpc.Service<DesktopSyncClient>()("DesktopSyncClient", {
  group: VaultSyncRpcs,
  protocol: (get) => get(chatProtocolLayerAtom),
  runtime: professionalBrowserRuntime.factory,
}) {}

const vaultSyncStatusKey = (workspaceId: WorkspaceIdentity.WorkspaceId) => `vault-sync-status:${workspaceId}`;

const vaultSyncConflictsKey = (workspaceId: WorkspaceIdentity.WorkspaceId) => `vault-sync-conflicts:${workspaceId}`;

/**
 * Atom family that subscribes to the workspace vault sync status over desktop RPC.
 *
 * **Details**
 *
 * The `WatchVaultSyncStatus` stream pushes a new status whenever the status
 * View changes, so the counts update when a pass finishes rather than at the
 * moment the trigger is accepted. The sidecar authorizes every frame like the
 * other View subscriptions. A trigger, review or accepted probe still
 * invalidates the status reactivity key, which re-subscribes.
 *
 * **Example** (Workspace status atom access)
 *
 * ```ts
 * import { DEFAULT_PROFESSIONAL_WORKSPACE_ID } from "@/workspace/ProfessionalWorkspace"
 * import { vaultSyncStatusAtom } from "@/sync/Sync.atoms"
 *
 * const status = vaultSyncStatusAtom(DEFAULT_PROFESSIONAL_WORKSPACE_ID)
 * console.log(typeof status === "object") // true
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const vaultSyncStatusAtom = Atom.family((workspaceId: WorkspaceIdentity.WorkspaceId) =>
  DesktopSyncClient.runtime
    .atom(
      Stream.unwrap(
        Effect.map(DesktopSyncClient, (client) =>
          client("WatchVaultSyncStatus", VaultSyncWorkspacePayload.make({ workspaceId }))
        )
      )
    )
    .pipe(Atom.withReactivity([vaultSyncStatusKey(workspaceId)]))
);

/**
 * Per-workspace connection re-read after an accepted probe.
 *
 * **Details**
 *
 * The probe itself is the `ProbeDestination` command the intent queue
 * delivers; its saga asks Box and refreshes the sidecar's availability. This
 * fn only invalidates the workspace status key, so {@link vaultSyncStatusAtom}
 * re-subscribes and its next frame reads that availability. It sends no
 * status read, so it can never start a second probe through the compatibility
 * `GetVaultSyncStatus` `forceProbe` path.
 *
 * **Example** (Retry atoms function check)
 *
 * ```ts
 * import { vaultSyncRetryConnectionAtoms } from "@/sync/Sync.atoms"
 *
 * console.log(typeof vaultSyncRetryConnectionAtoms === "function") // true
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const vaultSyncRetryConnectionAtoms = Atom.family((workspaceId: WorkspaceIdentity.WorkspaceId) =>
  DesktopSyncClient.runtime.fn<void>()(
    Effect.fnUntraced(function* () {
      const reactivity = yield* Reactivity.Reactivity;
      yield* reactivity.invalidate([vaultSyncStatusKey(workspaceId)]);
    })
  )
);

/**
 * Atom family that lists the workspace's open vault sync drift records.
 *
 * **Example** (Workspace conflicts atom access)
 *
 * ```ts
 * import { DEFAULT_PROFESSIONAL_WORKSPACE_ID } from "@/workspace/ProfessionalWorkspace"
 * import { vaultSyncConflictsAtom } from "@/sync/Sync.atoms"
 *
 * const conflicts = vaultSyncConflictsAtom(DEFAULT_PROFESSIONAL_WORKSPACE_ID)
 * console.log(typeof conflicts === "object") // true
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const vaultSyncConflictsAtom = Atom.family((workspaceId: WorkspaceIdentity.WorkspaceId) =>
  DesktopSyncClient.query("ListVaultSyncConflicts", VaultSyncWorkspacePayload.make({ workspaceId }), {
    reactivityKeys: [vaultSyncConflictsKey(workspaceId)],
  })
);
