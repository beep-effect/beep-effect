/**
 * Desktop vault sync client atoms.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { chatProtocolLayerAtom } from "@beep/agents-client";
import {
  MarkVaultSyncConflictReviewedPayload,
  VaultSyncRpcs,
  VaultSyncWorkspacePayload,
} from "@beep/documents-use-cases/public";
import { $ProfessionalDesktopId } from "@beep/identity/packages";
import { LogRedactedCauseOptions, logRedactedCause } from "@beep/observability";
import { LiteralKit } from "@beep/schema";
import { SyncConflictId } from "@beep/shared-domain/identity/Documents/SyncConflictId";
import { Effect, Semaphore, Tuple } from "effect";
import * as S from "effect/Schema";
import { Atom, AtomRegistry, AtomRpc, Reactivity } from "effect/unstable/reactivity";
import { failureMessageOr } from "@/lib/failureMessage";
import { professionalBrowserRuntime } from "@/runtime/ProfessionalAtomRuntime";
import type * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";

const $I = $ProfessionalDesktopId.create("sync/Sync.atoms");

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

class VaultSyncIdleState extends S.Class<VaultSyncIdleState>($I`VaultSyncIdleState`)(
  { kind: S.tag("idle") },
  $I.annote("VaultSyncIdleState", {
    description: "Vault sync controls are ready for the next operator action.",
  })
) {}

class VaultSyncRunningState extends S.Class<VaultSyncRunningState>($I`VaultSyncRunningState`)(
  { kind: S.tag("syncing") },
  $I.annote("VaultSyncRunningState", {
    description: "A workspace vault sync pass is currently running.",
  })
) {}

class VaultSyncReviewingState extends S.Class<VaultSyncReviewingState>($I`VaultSyncReviewingState`)(
  {
    kind: S.tag("reviewing"),
    conflictId: SyncConflictId,
  },
  $I.annote("VaultSyncReviewingState", {
    description: "A single vault sync conflict is being marked as reviewed.",
  })
) {}

class VaultSyncSucceededState extends S.Class<VaultSyncSucceededState>($I`VaultSyncSucceededState`)(
  {
    kind: S.tag("succeeded"),
    message: S.NonEmptyString,
  },
  $I.annote("VaultSyncSucceededState", {
    description: "The latest vault sync action completed successfully.",
  })
) {}

class VaultSyncFailedState extends S.Class<VaultSyncFailedState>($I`VaultSyncFailedState`)(
  {
    kind: S.tag("failed"),
    message: S.NonEmptyString,
  },
  $I.annote("VaultSyncFailedState", {
    description: "The latest vault sync action failed with an operator-safe message.",
  })
) {}

const VaultSyncPanelStateKind = LiteralKit(["idle", "syncing", "reviewing", "succeeded", "failed"]).pipe(
  $I.annoteSchema("VaultSyncPanelStateKind", {
    description: "Lifecycle variants for the vault sync operator controls.",
  })
);

/**
 * Exhaustive state machine for vault sync operator actions.
 *
 * **Example** (Creating idle panel state)
 *
 * ```ts
 * import { VaultSyncPanelState } from "@/sync/Sync.atoms"
 *
 * const state = VaultSyncPanelState.cases.idle.make()
 * console.log(state.kind) // "idle"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const VaultSyncPanelState = VaultSyncPanelStateKind.mapMembers(
  Tuple.evolve([
    () => VaultSyncIdleState,
    () => VaultSyncRunningState,
    () => VaultSyncReviewingState,
    () => VaultSyncSucceededState,
    () => VaultSyncFailedState,
  ])
)
  .annotate(
    $I.annote("VaultSyncPanelState", {
      description: "Exhaustive lifecycle state for vault sync and conflict-review actions.",
    })
  )
  .pipe(S.toTaggedUnion("kind"));

/**
 * Runtime type for {@link VaultSyncPanelState}.
 *
 * **Example** (Typing syncing panel state)
 *
 * ```ts
 * import { VaultSyncPanelState, type VaultSyncPanelState as State } from "@/sync/Sync.atoms"
 *
 * const state: State = VaultSyncPanelState.cases.syncing.make()
 * console.log(state.kind) // "syncing"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type VaultSyncPanelState = typeof VaultSyncPanelState.Type;

class TriggerVaultSyncCommand extends S.Class<TriggerVaultSyncCommand>($I`TriggerVaultSyncCommand`)(
  { kind: S.tag("trigger") },
  $I.annote("TriggerVaultSyncCommand", {
    description: "Request one serialized vault sync pass for the owning workspace.",
  })
) {}

class ReviewVaultSyncConflictCommand extends S.Class<ReviewVaultSyncConflictCommand>(
  $I`ReviewVaultSyncConflictCommand`
)(
  {
    kind: S.tag("review"),
    conflictId: SyncConflictId,
  },
  $I.annote("ReviewVaultSyncConflictCommand", {
    description: "Request serialized review of one conflict in the owning workspace.",
  })
) {}

const VaultSyncCommandKind = LiteralKit(["trigger", "review"]).pipe(
  $I.annoteSchema("VaultSyncCommandKind", {
    description: "Commands accepted by one workspace vault sync state machine.",
  })
);

/**
 * Exhaustive command accepted by a workspace vault sync action family.
 *
 * **Example** (Trigger command guard check)
 *
 * ```ts
 * import { VaultSyncCommand } from "@/sync/Sync.atoms"
 *
 * const command = VaultSyncCommand.cases.trigger.make()
 * console.log(VaultSyncCommand.guards.trigger(command)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const VaultSyncCommand = VaultSyncCommandKind.mapMembers(
  Tuple.evolve([() => TriggerVaultSyncCommand, () => ReviewVaultSyncConflictCommand])
)
  .annotate(
    $I.annote("VaultSyncCommand", {
      description: "Serialized operator commands for one workspace vault sync state machine.",
    })
  )
  .pipe(S.toTaggedUnion("kind"));

/**
 * Runtime type for {@link VaultSyncCommand}.
 *
 * @category models
 * @since 0.0.0
 */
type VaultSyncCommand = typeof VaultSyncCommand.Type;

/**
 * Per-workspace vault sync action state.
 *
 * **Example** (Workspace panel state access)
 *
 * ```ts
 * import { DEFAULT_PROFESSIONAL_WORKSPACE_ID } from "@/workspace/ProfessionalWorkspace"
 * import { vaultSyncPanelStateAtoms } from "@/sync/Sync.atoms"
 *
 * const state = vaultSyncPanelStateAtoms(DEFAULT_PROFESSIONAL_WORKSPACE_ID)
 * console.log(typeof state === "object") // true
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const vaultSyncPanelStateAtoms = Atom.family((_workspaceId: WorkspaceIdentity.WorkspaceId) =>
  Atom.make<VaultSyncPanelState>(VaultSyncPanelState.cases.idle.make())
);

/**
 * Atom family that reads the workspace vault sync status over desktop RPC.
 *
 * **Details**
 *
 * Refreshes whenever a sync trigger or conflict review invalidates the
 * workspace's status reactivity key.
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
  DesktopSyncClient.query("GetVaultSyncStatus", VaultSyncWorkspacePayload.make({ workspaceId }), {
    reactivityKeys: [vaultSyncStatusKey(workspaceId)],
  })
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

const handleVaultSyncFailure = Effect.fnUntraced(function* (
  failure: unknown,
  command: VaultSyncCommand["kind"],
  fallbackMessage: string,
  stateAtom: Atom.Writable<VaultSyncPanelState>,
  ctx: Atom.FnContext
) {
  yield* logRedactedCause(
    failure,
    LogRedactedCauseOptions.make({
      message: `professional desktop vault sync ${command} failed`,
      level: "Warn",
      attributes: {
        "documents.vault_sync.command": command,
        subsystem: "vault_sync",
      },
    })
  );
  yield* Effect.annotateCurrentSpan({
    "documents.vault_sync.outcome": "failed",
  });
  ctx.set(
    stateAtom,
    VaultSyncPanelState.cases.failed.make({
      message: failureMessageOr(fallbackMessage)(failure),
    })
  );
});

const triggerVaultSync = Effect.fn("documents.vault_sync.trigger")(function* (
  workspaceId: WorkspaceIdentity.WorkspaceId,
  client: DesktopSyncClient["Service"],
  ctx: Atom.FnContext
) {
  const stateAtom = vaultSyncPanelStateAtoms(workspaceId);
  yield* Effect.annotateCurrentSpan({
    "documents.vault_sync.workspace_id": workspaceId,
  });
  ctx.set(stateAtom, VaultSyncPanelState.cases.syncing.make());
  yield* Reactivity.mutation(client("TriggerVaultSync", VaultSyncWorkspacePayload.make({ workspaceId })), [
    vaultSyncStatusKey(workspaceId),
    vaultSyncConflictsKey(workspaceId),
  ]).pipe(
    Effect.matchEffect({
      onFailure: (failure) => handleVaultSyncFailure(failure, "trigger", "Vault sync failed.", stateAtom, ctx),
      onSuccess: () =>
        Effect.annotateCurrentSpan({
          "documents.vault_sync.outcome": "succeeded",
        }).pipe(
          Effect.andThen(
            Effect.sync(() =>
              ctx.set(
                stateAtom,
                VaultSyncPanelState.cases.succeeded.make({
                  message: "Sync complete.",
                })
              )
            )
          )
        ),
    })
  );
});

const reviewVaultSyncConflict = Effect.fn("documents.vault_sync.review")(function* (
  workspaceId: WorkspaceIdentity.WorkspaceId,
  conflictId: SyncConflictId,
  client: DesktopSyncClient["Service"],
  ctx: Atom.FnContext
) {
  const stateAtom = vaultSyncPanelStateAtoms(workspaceId);
  yield* Effect.annotateCurrentSpan({
    "documents.vault_sync.conflict_id": conflictId,
    "documents.vault_sync.workspace_id": workspaceId,
  });
  ctx.set(stateAtom, VaultSyncPanelState.cases.reviewing.make({ conflictId }));
  yield* Reactivity.mutation(
    client(
      "MarkVaultSyncConflictReviewed",
      MarkVaultSyncConflictReviewedPayload.make({
        conflictId,
        workspaceId,
      })
    ),
    [vaultSyncConflictsKey(workspaceId), vaultSyncStatusKey(workspaceId)]
  ).pipe(
    Effect.matchEffect({
      onFailure: (failure) =>
        handleVaultSyncFailure(failure, "review", "Marking the conflict reviewed failed.", stateAtom, ctx),
      onSuccess: () =>
        Effect.annotateCurrentSpan({
          "documents.vault_sync.outcome": "succeeded",
        }).pipe(Effect.andThen(Effect.sync(() => ctx.set(stateAtom, VaultSyncPanelState.cases.idle.make())))),
    })
  );
});

/**
 * Per-workspace command state machine for sync and conflict review.
 *
 * **Details**
 *
 * Commands for different workspaces run independently. Commands for the same
 * workspace share one semaphore and execute in FIFO order, so a review cannot
 * race a sync pass or overwrite its state transition.
 *
 * **Example** (Command atoms function check)
 *
 * ```ts
 * import { vaultSyncCommandAtoms } from "@/sync/Sync.atoms"
 *
 * console.log(typeof vaultSyncCommandAtoms === "function") // true
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const vaultSyncCommandAtoms = Atom.family((workspaceId: WorkspaceIdentity.WorkspaceId) => {
  const commandSemaphore = Semaphore.makeUnsafe(1);
  const stateAtom = vaultSyncPanelStateAtoms(workspaceId);

  return DesktopSyncClient.runtime.fn<VaultSyncCommand>()(
    Effect.fnUntraced(function* (command, ctx) {
      const client = yield* DesktopSyncClient;
      const registry = yield* AtomRegistry.AtomRegistry;
      const resetInterruptedCommand = Effect.sync(() => registry.set(stateAtom, VaultSyncPanelState.cases.idle.make()));

      const operation = VaultSyncCommand.match(command, {
        trigger: () => triggerVaultSync(workspaceId, client, ctx),
        review: ({ conflictId }) => reviewVaultSyncConflict(workspaceId, conflictId, client, ctx),
      });

      yield* commandSemaphore.withPermit(operation).pipe(Effect.onInterrupt(() => resetInterruptedCommand));
    }),
    { concurrent: true }
  );
});
