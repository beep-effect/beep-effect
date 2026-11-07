/**
 * Offline vault-sync intents: what the operator asked for while the sidecar
 * was unreachable, persisted in order until the server decides them.
 *
 * **Details**
 *
 * Local-first topology 2 (D8): every command is recorded as an intent before
 * it is sent and shown as predicted at once; the server's `decide` stays the
 * only authority. An intent records the request, never a fact the server owns.
 * An accepted delivery drops it; a typed rejection drops it and reverts its
 * prediction; an unreachable sidecar keeps it queued for the next replay.
 * Each intent keeps one id across every delivery attempt, which the server
 * uses as the request identity, so a replay never requests twice.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { RequestToken } from "@beep/documents-domain/aggregates/VaultSync";
import { $ProfessionalDesktopId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import { SyncConflictId } from "@beep/shared-domain/identity/Documents/SyncConflictId";
import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import * as Equal from "effect/Equal";
import { constant, dual } from "effect/Function";
import * as Random from "effect/Random";
import * as Atom from "effect/reactivity/Atom";
import * as S from "effect/Schema";
import * as Tuple from "effect/Tuple";
import { professionalStorageRuntime } from "@/runtime/ProfessionalAtomRuntime";
import type { SyncConflict } from "@beep/documents-domain/entities/SyncConflict";

const $I = $ProfessionalDesktopId.create("sync/VaultSyncIntents");

const intentFields = {
  intentId: RequestToken.annotateKey({ description: "Id kept across every delivery attempt of this intent." }),
  workspaceId: WorkspaceIdentity.WorkspaceId.annotateKey({ description: "Workspace the intent addresses." }),
  queuedAt: S.Finite.annotateKey({ description: "Epoch milliseconds when the operator asked." }),
};

class TriggerIntent extends S.Opaque<TriggerIntent, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("trigger"), ...intentFields }).pipe(
    $I.annoteSchema("TriggerIntent", { description: "The operator asked for one vault sync pass." })
  )
) {}

class ReviewIntent extends S.Opaque<ReviewIntent, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("review"),
    ...intentFields,
    conflictId: SyncConflictId.annotateKey({ description: "Conflict the operator marked reviewed." }),
    conflictKind: S.optionalKey(S.String).annotateKey({
      description: "Kind of the conflict as listed when reviewed, to show its row while the list cannot load.",
    }),
    localRelPath: S.optionalKey(S.String).annotateKey({
      description: "Local path of the conflict as listed when reviewed, to show its row while the list cannot load.",
    }),
  }).pipe($I.annoteSchema("ReviewIntent", { description: "The operator marked one conflict reviewed." }))
) {}

const VaultSyncIntentKind = LiteralKit(["trigger", "review"]).pipe(
  $I.annoteSchema("VaultSyncIntentKind", { description: "What a queued vault-sync intent asks for." })
);

/**
 * One queued vault-sync intent: a sync pass or a conflict review.
 *
 * **Example** (Make a trigger intent)
 *
 * ```ts
 * import { VaultSyncIntent } from "@/sync/VaultSyncIntents"
 * import { DEFAULT_PROFESSIONAL_WORKSPACE_ID } from "@/workspace/ProfessionalWorkspace"
 *
 * const intent = VaultSyncIntent.cases.trigger.make({
 *   intentId: "1-2",
 *   workspaceId: DEFAULT_PROFESSIONAL_WORKSPACE_ID,
 *   queuedAt: 0,
 * })
 * console.log(intent.kind) // "trigger"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const VaultSyncIntent = VaultSyncIntentKind.mapMembers(
  Tuple.evolve([() => TriggerIntent, () => ReviewIntent])
).pipe(
  $I.annoteSchema("VaultSyncIntent", {
    description: "A vault-sync request recorded before delivery and kept until the server decides it.",
  }),
  S.toTaggedUnion("kind")
);

/**
 * Runtime type for {@link VaultSyncIntent}.
 *
 * @category models
 * @since 0.0.0
 */
export type VaultSyncIntent = typeof VaultSyncIntent.Type;

/**
 * The persisted intent queue, oldest first, across workspaces.
 *
 * **Details**
 *
 * Stored in `localStorage` through the app's storage runtime, so intents
 * survive a reload or restart of the desktop shell while the sidecar is down.
 *
 * **Example** (Queue atom check)
 *
 * ```ts
 * import { vaultSyncIntentQueueAtom } from "@/sync/VaultSyncIntents"
 *
 * console.log(typeof vaultSyncIntentQueueAtom === "object") // true
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const vaultSyncIntentQueueAtom = Atom.kvs({
  runtime: professionalStorageRuntime,
  key: "beep.professional.vault-sync.intents.v1",
  schema: S.Array(VaultSyncIntent),
  defaultValue: constant<ReadonlyArray<VaultSyncIntent>>([]),
});

/**
 * Mint the id an intent keeps across every delivery attempt.
 *
 * **Example** (Mint an intent id)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { mintIntentId } from "@/sync/VaultSyncIntents"
 *
 * console.log(Effect.isEffect(mintIntentId)) // true
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const mintIntentId: Effect.Effect<RequestToken> = Effect.gen(function* () {
  const at = yield* Clock.currentTimeMillis;
  const n = yield* Random.nextIntBetween(0, Number.MAX_SAFE_INTEGER);
  return `${at}-${n}`;
});

/**
 * The queued intents of one workspace, oldest first.
 *
 * **Example** (Filter by workspace)
 *
 * ```ts
 * import { intentsOf } from "@/sync/VaultSyncIntents"
 * import { DEFAULT_PROFESSIONAL_WORKSPACE_ID } from "@/workspace/ProfessionalWorkspace"
 *
 * console.log(intentsOf([], DEFAULT_PROFESSIONAL_WORKSPACE_ID)) // []
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const intentsOf: {
  (workspaceId: WorkspaceIdentity.WorkspaceId): (queue: ReadonlyArray<VaultSyncIntent>) => Array<VaultSyncIntent>;
  (queue: ReadonlyArray<VaultSyncIntent>, workspaceId: WorkspaceIdentity.WorkspaceId): Array<VaultSyncIntent>;
} = dual(2, (queue: ReadonlyArray<VaultSyncIntent>, workspaceId: WorkspaceIdentity.WorkspaceId) =>
  A.filter(queue, (intent) => Equal.equals(intent.workspaceId, workspaceId))
);

/**
 * The queue without one intent.
 *
 * **Example** (Drop an intent)
 *
 * ```ts
 * import { withoutIntent } from "@/sync/VaultSyncIntents"
 *
 * console.log(withoutIntent([], "1-2")) // []
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const withoutIntent: {
  (intentId: string): (queue: ReadonlyArray<VaultSyncIntent>) => Array<VaultSyncIntent>;
  (queue: ReadonlyArray<VaultSyncIntent>, intentId: string): Array<VaultSyncIntent>;
} = dual(2, (queue: ReadonlyArray<VaultSyncIntent>, intentId: string) =>
  A.filter(queue, (intent) => intent.intentId !== intentId)
);

/**
 * The queue with an intent appended. A second trigger while one is queued
 * adds nothing: one pass covers both; a second review of one conflict also
 * adds nothing.
 *
 * **Example** (Enqueue once)
 *
 * ```ts
 * import { enqueueIntent, VaultSyncIntent } from "@/sync/VaultSyncIntents"
 * import { DEFAULT_PROFESSIONAL_WORKSPACE_ID } from "@/workspace/ProfessionalWorkspace"
 *
 * const intent = VaultSyncIntent.cases.trigger.make({
 *   intentId: "1-2",
 *   workspaceId: DEFAULT_PROFESSIONAL_WORKSPACE_ID,
 *   queuedAt: 0,
 * })
 * console.log(enqueueIntent(enqueueIntent([], intent), intent).length) // 1
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const enqueueIntent: {
  (intent: VaultSyncIntent): (queue: ReadonlyArray<VaultSyncIntent>) => ReadonlyArray<VaultSyncIntent>;
  (queue: ReadonlyArray<VaultSyncIntent>, intent: VaultSyncIntent): ReadonlyArray<VaultSyncIntent>;
} = dual(
  2,
  (queue: ReadonlyArray<VaultSyncIntent>, intent: VaultSyncIntent): ReadonlyArray<VaultSyncIntent> =>
    A.some(intentsOf(queue, intent.workspaceId), (queued) =>
      VaultSyncIntent.match(intent, {
        trigger: () => VaultSyncIntent.guards.trigger(queued),
        review: ({ conflictId }) =>
          VaultSyncIntent.guards.review(queued) && Equal.equals(queued.conflictId, conflictId),
      })
    )
      ? queue
      : A.append(queue, intent)
);

/**
 * Whether a sync pass is queued for a workspace.
 *
 * **Example** (Nothing queued)
 *
 * ```ts
 * import { triggerQueued } from "@/sync/VaultSyncIntents"
 * import { DEFAULT_PROFESSIONAL_WORKSPACE_ID } from "@/workspace/ProfessionalWorkspace"
 *
 * console.log(triggerQueued([], DEFAULT_PROFESSIONAL_WORKSPACE_ID)) // false
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const triggerQueued: {
  (workspaceId: WorkspaceIdentity.WorkspaceId): (queue: ReadonlyArray<VaultSyncIntent>) => boolean;
  (queue: ReadonlyArray<VaultSyncIntent>, workspaceId: WorkspaceIdentity.WorkspaceId): boolean;
} = dual(2, (queue: ReadonlyArray<VaultSyncIntent>, workspaceId: WorkspaceIdentity.WorkspaceId) =>
  A.some(intentsOf(queue, workspaceId), VaultSyncIntent.guards.trigger)
);

/**
 * The predicted state of a conflict: reviewed once a review of it is queued.
 *
 * **Example** (No queued review)
 *
 * ```ts
 * import { reviewQueued } from "@/sync/VaultSyncIntents"
 * import { DEFAULT_PROFESSIONAL_WORKSPACE_ID } from "@/workspace/ProfessionalWorkspace"
 * import { SyncConflictId } from "@beep/shared-domain/identity/Documents/SyncConflictId"
 *
 * console.log(reviewQueued([], DEFAULT_PROFESSIONAL_WORKSPACE_ID, SyncConflictId.make(1))) // false
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const reviewQueued: {
  (
    workspaceId: WorkspaceIdentity.WorkspaceId,
    conflictId: SyncConflict["id"]
  ): (queue: ReadonlyArray<VaultSyncIntent>) => boolean;
  (
    queue: ReadonlyArray<VaultSyncIntent>,
    workspaceId: WorkspaceIdentity.WorkspaceId,
    conflictId: SyncConflict["id"]
  ): boolean;
} = dual(
  3,
  (queue: ReadonlyArray<VaultSyncIntent>, workspaceId: WorkspaceIdentity.WorkspaceId, conflictId: SyncConflict["id"]) =>
    A.some(
      intentsOf(queue, workspaceId),
      (intent) => VaultSyncIntent.guards.review(intent) && Equal.equals(intent.conflictId, conflictId)
    )
);
