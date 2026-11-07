/**
 * Desktop vault sync client atoms.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { chatProtocolLayerAtom } from "@beep/agents-client";
import {
  GetVaultSyncStatusPayload,
  MarkVaultSyncConflictReviewedPayload,
  TriggerVaultSyncPayload,
  VaultSyncRpcs,
  VaultSyncWorkspacePayload,
} from "@beep/documents-use-cases/public";
import { $ProfessionalDesktopId } from "@beep/identity/packages";
import { LogRedactedCauseOptions, logRedactedCause } from "@beep/observability/CauseRedaction";
import { LiteralKit } from "@beep/schema/LiteralKit";
import { SyncConflictId } from "@beep/shared-domain/identity/Documents/SyncConflictId";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import * as AtomRpc from "effect/reactivity/AtomRpc";
import * as Reactivity from "effect/reactivity/Reactivity";
import * as S from "effect/Schema";
import * as Semaphore from "effect/Semaphore";
import * as Stream from "effect/Stream";
import * as Tuple from "effect/Tuple";
import { failureMessageOr } from "@/lib/failureMessage";
import { professionalBrowserRuntime } from "@/runtime/ProfessionalAtomRuntime";
import {
  enqueueIntent,
  intentsOf,
  mintIntentId,
  VaultSyncIntent,
  vaultSyncIntentQueueAtom,
  withoutIntent,
} from "./VaultSyncIntents.ts";
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

class VaultSyncIdleState extends S.Opaque<VaultSyncIdleState, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("idle") }).pipe(
    $I.annoteSchema("VaultSyncIdleState", {
      description: "Vault sync controls are ready for the next operator action.",
    })
  )
) {}

class VaultSyncRunningState extends S.Opaque<VaultSyncRunningState, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("syncing") }).pipe(
    $I.annoteSchema("VaultSyncRunningState", {
      description: "A workspace vault sync pass is currently running.",
    })
  )
) {}

class VaultSyncReviewingState extends S.Opaque<VaultSyncReviewingState, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("reviewing"),
    conflictId: SyncConflictId,
  }).pipe(
    $I.annoteSchema("VaultSyncReviewingState", {
      description: "A single vault sync conflict is being marked as reviewed.",
    })
  )
) {}

class VaultSyncQueuedState extends S.Opaque<VaultSyncQueuedState, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("queued"),
    message: S.NonEmptyString,
  }).pipe(
    $I.annoteSchema("VaultSyncQueuedState", {
      description: "The sidecar is unreachable: the latest action is queued and replays on reconnect.",
    })
  )
) {}

class VaultSyncSucceededState extends S.Opaque<VaultSyncSucceededState, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("succeeded"),
    message: S.NonEmptyString,
  }).pipe(
    $I.annoteSchema("VaultSyncSucceededState", {
      description: "The latest vault sync action completed successfully.",
    })
  )
) {}

class VaultSyncFailedState extends S.Opaque<VaultSyncFailedState, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("failed"),
    message: S.NonEmptyString,
  }).pipe(
    $I.annoteSchema("VaultSyncFailedState", {
      description: "The latest vault sync action failed with an operator-safe message.",
    })
  )
) {}

const VaultSyncPanelStateKind = LiteralKit(["idle", "syncing", "reviewing", "queued", "succeeded", "failed"]).pipe(
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
 * const state = VaultSyncPanelState.cases.idle.make({})
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
    () => VaultSyncQueuedState,
    () => VaultSyncSucceededState,
    () => VaultSyncFailedState,
  ])
).pipe(
  $I.annoteSchema("VaultSyncPanelState", {
    description: "Exhaustive lifecycle state for vault sync and conflict-review actions.",
  }),
  S.toTaggedUnion("kind")
);

/**
 * Runtime type for {@link VaultSyncPanelState}.
 *
 * **Example** (Typing syncing panel state)
 *
 * ```ts
 * import { VaultSyncPanelState, type VaultSyncPanelState as State } from "@/sync/Sync.atoms"
 *
 * const state: State = VaultSyncPanelState.cases.syncing.make({})
 * console.log(state.kind) // "syncing"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type VaultSyncPanelState = typeof VaultSyncPanelState.Type;

class TriggerVaultSyncCommand extends S.Opaque<TriggerVaultSyncCommand, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("trigger") }).pipe(
    $I.annoteSchema("TriggerVaultSyncCommand", {
      description: "Request one serialized vault sync pass for the owning workspace.",
    })
  )
) {}

class ReviewVaultSyncConflictCommand extends S.Opaque<
  ReviewVaultSyncConflictCommand,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    kind: S.tag("review"),
    conflictId: SyncConflictId,
  }).pipe(
    $I.annoteSchema("ReviewVaultSyncConflictCommand", {
      description: "Request serialized review of one conflict in the owning workspace.",
    })
  )
) {}

class ReplayVaultSyncIntentsCommand extends S.Opaque<
  ReplayVaultSyncIntentsCommand,
  { readonly brand: unique symbol }
>()(
  S.Struct({ kind: S.tag("replay") }).pipe(
    $I.annoteSchema("ReplayVaultSyncIntentsCommand", {
      description: "Deliver the workspace's queued intents, oldest first, until the sidecar is unreachable.",
    })
  )
) {}

const VaultSyncCommandKind = LiteralKit(["trigger", "review", "replay"]).pipe(
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
 * const command = VaultSyncCommand.cases.trigger.make({})
 * console.log(VaultSyncCommand.guards.trigger(command)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const VaultSyncCommand = VaultSyncCommandKind.mapMembers(
  Tuple.evolve([
    () => TriggerVaultSyncCommand,
    () => ReviewVaultSyncConflictCommand,
    () => ReplayVaultSyncIntentsCommand,
  ])
).pipe(
  $I.annoteSchema("VaultSyncCommand", {
    description: "Serialized operator commands for one workspace vault sync state machine.",
  }),
  S.toTaggedUnion("kind")
);

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
  Atom.make<VaultSyncPanelState>(VaultSyncPanelState.cases.idle.make({}))
);

/**
 * Atom family that subscribes to the workspace vault sync status over desktop RPC.
 *
 * **Details**
 *
 * The `WatchVaultSyncStatus` stream pushes a new status whenever the status
 * View changes, so the counts update when a pass finishes rather than at the
 * moment the trigger is accepted. The sidecar authorizes every frame like the
 * other View subscriptions. A trigger or review still invalidates the status
 * reactivity key, which re-subscribes.
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

const forceVaultSyncProbe = Effect.fn("documents.vault_sync.force_probe")(function* (
  workspaceId: WorkspaceIdentity.WorkspaceId,
  client: DesktopSyncClient["Service"]
) {
  const reactivity = yield* Reactivity.Reactivity;
  yield* Effect.annotateCurrentSpan({
    "documents.vault_sync.workspace_id": workspaceId,
  });
  yield* Reactivity.mutation(
    client("GetVaultSyncStatus", GetVaultSyncStatusPayload.make({ forceProbe: true, workspaceId })),
    [vaultSyncStatusKey(workspaceId)]
  ).pipe(
    Effect.catchCause((cause) =>
      logRedactedCause(
        cause,
        LogRedactedCauseOptions.make({
          message: "professional desktop vault sync force probe failed",
          level: "Warn",
          attributes: {
            "documents.vault_sync.command": "force-probe",
            subsystem: "vault_sync",
          },
        })
        // Invalidate anyway: the status query owns failure presentation, so a
        // failed forced probe still re-runs it instead of leaving a retry
        // that visibly did nothing.
      ).pipe(Effect.andThen(reactivity.invalidate([vaultSyncStatusKey(workspaceId)])))
    )
  );
});

/**
 * Per-workspace forced probe retry for the vault sync connection.
 *
 * **Details**
 *
 * The passive status atom is served from the sidecar's short probe cache, so a
 * plain refresh inside the failure TTL replays the cached failed probe. This
 * fn sends `forceProbe: true`, which makes the sidecar discard the cached
 * answer and ask the provider now, then invalidates the workspace status key
 * so {@link vaultSyncStatusAtom} re-reads the freshly cached result.
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
      const client = yield* DesktopSyncClient;
      yield* forceVaultSyncProbe(workspaceId, client);
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

const DeliveryOutcome = S.TaggedUnion({
  Accepted: {},
  Rejected: { message: S.NonEmptyString },
  Unreachable: {},
}).pipe(
  $I.annoteSchema("VaultSyncDeliveryOutcome", {
    description: "How one delivery attempt of a queued intent ended; a rejection keeps the server's safe message.",
  })
);
type DeliveryOutcome = typeof DeliveryOutcome.Type;

/** How often a mounted panel replays queued intents while any are queued. */
const replayInterval = Duration.seconds(2);

const succeededMessage = VaultSyncIntent.match({
  trigger: () => "Sync complete.",
  review: () => "Conflict marked reviewed.",
});

const rejectedMessage = VaultSyncIntent.match({
  trigger: () => "The server refused the sync request. Nothing changed.",
  review: () => "The server refused the review. The conflict is open again.",
});

const queuedMessage = VaultSyncIntent.match({
  trigger: () => "Sidecar unreachable. Sync is queued and runs when it reconnects.",
  review: () => "Sidecar unreachable. The review is queued and replays when it reconnects.",
});

/**
 * Send one intent. A typed `VaultSyncActionError` is the server deciding
 * against it; any other failure (the RPC transport, a sidecar that is gone)
 * means it never reached the server.
 */
const deliverIntent = (intent: VaultSyncIntent, client: DesktopSyncClient["Service"]): Effect.Effect<DeliveryOutcome> =>
  VaultSyncIntent.match(intent, {
    trigger: ({ intentId, workspaceId }) =>
      Effect.asVoid(client("TriggerVaultSync", TriggerVaultSyncPayload.make({ intentId, workspaceId }))),
    review: ({ conflictId, workspaceId }) =>
      Effect.asVoid(
        client("MarkVaultSyncConflictReviewed", MarkVaultSyncConflictReviewedPayload.make({ conflictId, workspaceId }))
      ),
  }).pipe(
    Effect.as(DeliveryOutcome.cases.Accepted.make({})),
    Effect.catchTag("VaultSyncActionError", (failure) =>
      logRedactedCause(
        failure,
        LogRedactedCauseOptions.make({
          message: `professional desktop vault sync ${intent.kind} rejected`,
          level: "Warn",
          attributes: { "documents.vault_sync.command": intent.kind, subsystem: "vault_sync" },
        })
      ).pipe(
        Effect.as(DeliveryOutcome.cases.Rejected.make({ message: failureMessageOr(rejectedMessage(intent))(failure) }))
      )
    ),
    Effect.catchCause(() => Effect.succeed(DeliveryOutcome.cases.Unreachable.make({}))),
    Effect.tap((outcome) => Effect.annotateCurrentSpan({ "documents.vault_sync.outcome": outcome._tag }))
  );

/**
 * Deliver one queued intent and settle it: an accepted or rejected intent
 * leaves the queue (a rejection reverts its prediction with it); an
 * unreachable one stays. Returns whether the sidecar answered.
 */
const settleIntent = Effect.fnUntraced(function* (
  intent: VaultSyncIntent,
  client: DesktopSyncClient["Service"],
  registry: AtomRegistry.AtomRegistry
) {
  const reactivity = yield* Reactivity.Reactivity;
  const stateAtom = vaultSyncPanelStateAtoms(intent.workspaceId);
  const outcome = yield* deliverIntent(intent, client);
  if (DeliveryOutcome.guards.Unreachable(outcome)) {
    registry.set(stateAtom, VaultSyncPanelState.cases.queued.make({ message: queuedMessage(intent) }));
    return false;
  }
  registry.set(vaultSyncIntentQueueAtom, withoutIntent(registry.get(vaultSyncIntentQueueAtom), intent.intentId));
  registry.set(
    stateAtom,
    DeliveryOutcome.match(outcome, {
      Accepted: () => VaultSyncPanelState.cases.succeeded.make({ message: succeededMessage(intent) }),
      Rejected: ({ message }) => VaultSyncPanelState.cases.failed.make({ message }),
      Unreachable: () => VaultSyncPanelState.cases.queued.make({ message: queuedMessage(intent) }),
    })
  );
  yield* reactivity.invalidate([vaultSyncStatusKey(intent.workspaceId), vaultSyncConflictsKey(intent.workspaceId)]);
  return true;
});

/** Record an intent (its prediction shows at once), then try to deliver it. */
const submitIntent = Effect.fnUntraced(function* (
  intent: VaultSyncIntent,
  client: DesktopSyncClient["Service"],
  registry: AtomRegistry.AtomRegistry
) {
  yield* Effect.annotateCurrentSpan({ "documents.vault_sync.workspace_id": intent.workspaceId });
  registry.set(
    vaultSyncPanelStateAtoms(intent.workspaceId),
    VaultSyncIntent.match(intent, {
      trigger: () => VaultSyncPanelState.cases.syncing.make({}),
      review: ({ conflictId }) => VaultSyncPanelState.cases.reviewing.make({ conflictId }),
    })
  );
  registry.set(vaultSyncIntentQueueAtom, enqueueIntent(registry.get(vaultSyncIntentQueueAtom), intent));
  yield* settleIntent(intent, client, registry);
});

/** Deliver intents oldest first; stop at the first one the sidecar cannot take. */
const settleInOrder = (
  intents: ReadonlyArray<VaultSyncIntent>,
  client: DesktopSyncClient["Service"],
  registry: AtomRegistry.AtomRegistry
): Effect.Effect<void, never, Reactivity.Reactivity> =>
  A.match(intents, {
    onEmpty: () => Effect.void,
    onNonEmpty: ([head, ...rest]) =>
      Effect.flatMap(settleIntent(head, client, registry), (answered) =>
        answered ? settleInOrder(rest, client, registry) : Effect.void
      ),
  });

const replayIntents = Effect.fn("documents.vault_sync.replay")(function* (
  workspaceId: WorkspaceIdentity.WorkspaceId,
  client: DesktopSyncClient["Service"],
  registry: AtomRegistry.AtomRegistry
) {
  const queued = intentsOf(registry.get(vaultSyncIntentQueueAtom), workspaceId);
  yield* Effect.annotateCurrentSpan({
    "documents.vault_sync.workspace_id": workspaceId,
    "documents.vault_sync.queued": queued.length,
  });
  yield* settleInOrder(queued, client, registry);
});

const triggerIntent = Effect.fn("documents.vault_sync.trigger")(function* (
  workspaceId: WorkspaceIdentity.WorkspaceId,
  client: DesktopSyncClient["Service"],
  registry: AtomRegistry.AtomRegistry
) {
  const intentId = yield* mintIntentId;
  const queuedAt = yield* Clock.currentTimeMillis;
  yield* submitIntent(VaultSyncIntent.cases.trigger.make({ intentId, workspaceId, queuedAt }), client, registry);
});

const reviewIntent = Effect.fn("documents.vault_sync.review")(function* (
  workspaceId: WorkspaceIdentity.WorkspaceId,
  conflictId: SyncConflictId,
  client: DesktopSyncClient["Service"],
  registry: AtomRegistry.AtomRegistry
) {
  yield* Effect.annotateCurrentSpan({ "documents.vault_sync.conflict_id": conflictId });
  const intentId = yield* mintIntentId;
  const queuedAt = yield* Clock.currentTimeMillis;
  yield* submitIntent(
    VaultSyncIntent.cases.review.make({ intentId, workspaceId, queuedAt, conflictId }),
    client,
    registry
  );
});

/**
 * Per-workspace command state machine for sync, conflict review and replay
 * of queued intents.
 *
 * **Details**
 *
 * Every command is an intent first: it is persisted in
 * {@link vaultSyncIntentQueueAtom} and shown as predicted before it is sent.
 * An unreachable sidecar leaves it queued (panel state `queued`); `replay`
 * delivers the queue in order once the sidecar answers, and a typed rejection
 * reverts the prediction (panel state `failed`). Commands for different
 * workspaces run independently. Commands for the same workspace share one
 * semaphore and execute in FIFO order, so a review cannot race a sync pass or
 * a replay.
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
    Effect.fnUntraced(function* (command) {
      const client = yield* DesktopSyncClient;
      const registry = yield* AtomRegistry.AtomRegistry;
      const resetInterruptedCommand = Effect.sync(() =>
        registry.set(stateAtom, VaultSyncPanelState.cases.idle.make({}))
      );

      const operation = VaultSyncCommand.match(command, {
        trigger: () => triggerIntent(workspaceId, client, registry),
        review: ({ conflictId }) => reviewIntent(workspaceId, conflictId, client, registry),
        replay: () => replayIntents(workspaceId, client, registry),
      });

      yield* commandSemaphore.withPermit(operation).pipe(Effect.onInterrupt(() => resetInterruptedCommand));
    }),
    { concurrent: true }
  );
});

/**
 * Per-workspace replay loop: while mounted, it asks for a replay every two
 * seconds whenever intents of the workspace are queued.
 *
 * **Example** (Replay atom check)
 *
 * ```ts
 * import { vaultSyncIntentReplayAtom } from "@/sync/Sync.atoms"
 * import { DEFAULT_PROFESSIONAL_WORKSPACE_ID } from "@/workspace/ProfessionalWorkspace"
 *
 * console.log(typeof vaultSyncIntentReplayAtom(DEFAULT_PROFESSIONAL_WORKSPACE_ID) === "object") // true
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const vaultSyncIntentReplayAtom = Atom.family((workspaceId: WorkspaceIdentity.WorkspaceId) =>
  DesktopSyncClient.runtime.atom(
    Effect.gen(function* () {
      const registry = yield* AtomRegistry.AtomRegistry;
      const replay = vaultSyncCommandAtoms(workspaceId);
      const askForReplay = Effect.sync(() => {
        if (A.isReadonlyArrayNonEmpty(intentsOf(registry.get(vaultSyncIntentQueueAtom), workspaceId)))
          registry.set(replay, VaultSyncCommand.cases.replay.make({}));
      });
      return yield* Effect.sleep(replayInterval).pipe(Effect.andThen(askForReplay), Effect.forever);
    })
  )
);
