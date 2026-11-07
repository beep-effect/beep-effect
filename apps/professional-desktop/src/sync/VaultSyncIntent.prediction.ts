/**
 * Local prediction of queued vault-sync intents through the domain's own decide and evolve.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as V from "@beep/documents-domain/aggregates/VaultSync";
import { $ProfessionalDesktopId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as H from "effect/HashMap";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import {
  VaultSyncAction,
  VaultSyncIntent,
  VaultSyncIntentQueue,
  VaultSyncRefusalReason,
} from "./VaultSyncIntent.model.ts";
import type * as DateTime from "effect/DateTime";

const $I = $ProfessionalDesktopId.create("sync/VaultSyncIntent.prediction");

/**
 * The authoritative destination state the renderer last read from the sidecar.
 *
 * **Details**
 *
 * `destination` is the SyncDestination aggregate state carried by the VaultSyncStatus View, and
 * `conflicts` is the OpenConflicts View keyed by remote event id. Both are server facts.
 *
 * **Example** (Unregistered server state)
 *
 * ```ts
 * import * as V from "@beep/documents-domain/aggregates/VaultSync"
 * import * as H from "effect/HashMap"
 * import { VaultSyncServerState } from "@/sync/VaultSyncIntent.prediction"
 *
 * const state = VaultSyncServerState.make({
 *   destinationId: V.DestinationId.make("documents_sync_destination_avault"),
 *   destination: { _tag: "Unregistered" },
 *   conflicts: H.empty(),
 * })
 * console.log(state.destination._tag) // "Unregistered"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class VaultSyncServerState extends S.Opaque<VaultSyncServerState, { readonly brand: unique symbol }>()(
  S.Struct({
    destinationId: V.DestinationId,
    destination: V.DestinationState,
    conflicts: S.HashMap(S.String, V.ConflictRecord),
  }).pipe(
    $I.annoteSchema("VaultSyncServerState", {
      description: "The destination and open conflicts last read from the vault-sync Api.",
    })
  )
) {}

/**
 * Outcome of deciding one intent locally.
 *
 * @category models
 * @since 0.0.0
 */
const VaultSyncPredictionOutcome = LiteralKit(["accepted", "rejected", "unpredictable"]).pipe(
  $I.annoteSchema("VaultSyncPredictionOutcome", {
    description: "Whether the local decide accepted, rejected or could not judge an intent.",
  })
);

/**
 * Runtime type for {@link VaultSyncPredictionOutcome}.
 *
 * @category models
 * @since 0.0.0
 */
type VaultSyncPredictionOutcome = typeof VaultSyncPredictionOutcome.Type;

/**
 * One queued intent with what the local decide predicts for it.
 *
 * @category models
 * @since 0.0.0
 */
class VaultSyncPredictedIntent extends S.Opaque<VaultSyncPredictedIntent, { readonly brand: unique symbol }>()(
  S.Struct({
    intent: VaultSyncIntent,
    outcome: VaultSyncPredictionOutcome,
    rejection: S.OptionFromOptionalKey(VaultSyncRefusalReason),
  }).pipe(
    $I.annoteSchema("VaultSyncPredictedIntent", {
      description: "A queued intent paired with its locally predicted outcome.",
    })
  )
) {}

/**
 * The server state with every queued intent applied, as the panel renders it before confirmation.
 *
 * @category models
 * @since 0.0.0
 */
export class VaultSyncPrediction extends S.Opaque<VaultSyncPrediction, { readonly brand: unique symbol }>()(
  S.Struct({
    server: VaultSyncServerState,
    destination: V.DestinationState,
    pending: VaultSyncIntentQueue,
    intents: S.Array(VaultSyncPredictedIntent),
  }).pipe(
    $I.annoteSchema("VaultSyncPrediction", {
      description: "Server destination state folded with the intents still queued for it.",
    })
  )
) {}

type DestinationStep = {
  readonly outcome: VaultSyncPredictionOutcome;
  readonly destination: V.DestinationState;
  readonly rejection: O.Option<VaultSyncRefusalReason>;
};

const step = (
  destination: V.DestinationState,
  prediction:
    | { readonly _tag: "Accepted"; readonly state: V.DestinationState }
    | { readonly _tag: "Rejected"; readonly rejection: V.SyncRuleViolation }
    | { readonly _tag: "Unpredictable" }
): DestinationStep =>
  prediction._tag === "Accepted"
    ? { outcome: "accepted", destination: prediction.state, rejection: O.none() }
    : prediction._tag === "Rejected"
      ? { outcome: "rejected", destination, rejection: O.some(prediction.rejection) }
      : { outcome: "unpredictable", destination, rejection: O.none() };

type ReviewTarget = {
  readonly remoteEventId: string;
  readonly workspaceId: number;
  readonly healOperationId: V.OperationId;
};

const reviewConflictCommand = (destinationId: V.DestinationId, review: ReviewTarget) =>
  V.ReviewConflict.make({
    remoteEventId: review.remoteEventId,
    workspaceId: review.workspaceId,
    destinationId,
    correction: null,
    healOperationId: review.healOperationId,
  });

const predictIntentImpl = (
  destination: V.DestinationState,
  conflicts: H.HashMap<string, V.ConflictRecord>,
  intent: VaultSyncIntent,
  now: DateTime.Utc
): DestinationStep => {
  const options = { id: intent.destinationId, now, commandId: intent.commandId };
  const requestId = intent.commandId;
  return VaultSyncAction.match(intent.action, {
    "request-sync": () =>
      step(destination, V.SyncDestination.predict(destination, V.RequestVaultSync.make({ requestId }), options)),
    probe: () =>
      step(destination, V.SyncDestination.predict(destination, V.ProbeDestination.make({ requestId }), options)),
    pause: () => step(destination, V.SyncDestination.predict(destination, V.PauseDestination.make({}), options)),
    resume: () => step(destination, V.SyncDestination.predict(destination, V.ResumeDestination.make({}), options)),
    "review-conflict": (review): DestinationStep => {
      const record = O.getOrNull(H.get(conflicts, review.remoteEventId));
      const prediction = V.SyncConflict.predict(record, reviewConflictCommand(intent.destinationId, review), {
        id: review.conflictId,
        now,
        commandId: intent.commandId,
      });
      return prediction._tag === "Rejected"
        ? { outcome: "rejected", destination, rejection: O.some(prediction.rejection) }
        : { outcome: prediction._tag === "Accepted" ? "accepted" : "unpredictable", destination, rejection: O.none() };
    },
  });
};

/**
 * Decide one intent against a destination state with the aggregates' own decide and evolve.
 *
 * **Details**
 *
 * Destination intents run `SyncDestination.predict`; a conflict review runs `SyncConflict.predict`
 * against the open conflict the server reported. A review never changes the destination state.
 * The prediction only informs the panel: the server decide stays the only authority.
 *
 * **Example** (Predict a pause)
 *
 * ```ts
 * import * as V from "@beep/documents-domain/aggregates/VaultSync"
 * import * as DateTime from "effect/DateTime"
 * import * as H from "effect/HashMap"
 * import { VaultSyncAction, VaultSyncIntent } from "@/sync/VaultSyncIntent.model"
 * import { predictIntent } from "@/sync/VaultSyncIntent.prediction"
 *
 * const destinationId = V.DestinationId.make("documents_sync_destination_avault")
 * const action = VaultSyncAction.cases.pause.make({})
 * const intent = VaultSyncIntent.make({ commandId: "c1", destinationId, queuedAt: 0, action })
 * const step = predictIntent({ _tag: "Unregistered" }, H.empty(), intent, DateTime.makeUnsafe(0))
 * console.log(step.outcome) // "rejected"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const predictIntent: {
  (
    conflicts: H.HashMap<string, V.ConflictRecord>,
    intent: VaultSyncIntent,
    now: DateTime.Utc
  ): (destination: V.DestinationState) => DestinationStep;
  (
    destination: V.DestinationState,
    conflicts: H.HashMap<string, V.ConflictRecord>,
    intent: VaultSyncIntent,
    now: DateTime.Utc
  ): DestinationStep;
} = dual(4, predictIntentImpl);

const foldIntentsImpl = (
  server: VaultSyncServerState,
  queue: VaultSyncIntentQueue,
  now: DateTime.Utc
): VaultSyncPrediction => {
  const pending = A.filter(queue, (intent) => intent.destinationId === server.destinationId);
  const folded = A.reduce(
    pending,
    { destination: server.destination, intents: A.empty<VaultSyncPredictedIntent>() },
    (acc, intent) => {
      const next = predictIntent(acc.destination, server.conflicts, intent, now);
      return {
        destination: next.destination,
        intents: A.append(
          acc.intents,
          VaultSyncPredictedIntent.make({ intent, outcome: next.outcome, rejection: next.rejection })
        ),
      };
    }
  );
  return VaultSyncPrediction.make({ server, destination: folded.destination, pending, intents: folded.intents });
};

/**
 * Fold the queued intents for one destination over the server state, in queue order.
 *
 * **Details**
 *
 * Removing an intent from the queue and folding again is the revert: nothing is rolled back by
 * hand, so a refused intent can never leave its predicted effect behind.
 *
 * **Example** (No queued intents)
 *
 * ```ts
 * import * as V from "@beep/documents-domain/aggregates/VaultSync"
 * import * as DateTime from "effect/DateTime"
 * import * as H from "effect/HashMap"
 * import { foldIntents, VaultSyncServerState } from "@/sync/VaultSyncIntent.prediction"
 *
 * const server = VaultSyncServerState.make({
 *   destinationId: V.DestinationId.make("documents_sync_destination_avault"),
 *   destination: { _tag: "Unregistered" },
 *   conflicts: H.empty(),
 * })
 * console.log(foldIntents(server, [], DateTime.makeUnsafe(0)).intents.length) // 0
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const foldIntents: {
  (queue: VaultSyncIntentQueue, now: DateTime.Utc): (server: VaultSyncServerState) => VaultSyncPrediction;
  (server: VaultSyncServerState, queue: VaultSyncIntentQueue, now: DateTime.Utc): VaultSyncPrediction;
} = dual(3, foldIntentsImpl);
