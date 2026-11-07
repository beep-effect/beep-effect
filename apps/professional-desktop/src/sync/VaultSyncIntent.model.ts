/**
 * Offline vault-sync intents: what the operator asked for, never facts the sidecar owns.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as V from "@beep/documents-domain/aggregates/VaultSync";
import { $ProfessionalDesktopId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as S from "effect/Schema";
import * as Tuple from "effect/Tuple";

const $I = $ProfessionalDesktopId.create("sync/VaultSyncIntent.model");

/**
 * The operator asked the destination to run one sync pass.
 *
 * @category models
 * @since 0.0.0
 */
// fallow-ignore-next-line unused-export -- a member of the exported VaultSyncAction union; declaration emit names it in the submit atom's type (TS2527 otherwise). Owner: @beep/professional-desktop. Exit: remove when a consumer imports it directly.
export class RequestSyncAction extends S.Opaque<RequestSyncAction, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("request-sync") }).pipe(
    $I.annoteSchema("RequestSyncAction", {
      description: "The operator asked the destination to run one sync pass.",
    })
  )
) {}

/**
 * The operator asked the destination to probe its Box connection again.
 *
 * @category models
 * @since 0.0.0
 */
// fallow-ignore-next-line unused-export -- a member of the exported VaultSyncAction union; declaration emit names it in the submit atom's type (TS2527 otherwise). Owner: @beep/professional-desktop. Exit: remove when a consumer imports it directly.
export class ProbeAction extends S.Opaque<ProbeAction, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("probe") }).pipe(
    $I.annoteSchema("ProbeAction", {
      description: "The operator asked the destination to probe its Box connection again.",
    })
  )
) {}

/**
 * The operator asked the destination to stop starting sync passes.
 *
 * @category models
 * @since 0.0.0
 */
// fallow-ignore-next-line unused-export -- a member of the exported VaultSyncAction union; declaration emit names it in the submit atom's type (TS2527 otherwise). Owner: @beep/professional-desktop. Exit: remove when a consumer imports it directly.
export class PauseAction extends S.Opaque<PauseAction, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("pause") }).pipe(
    $I.annoteSchema("PauseAction", {
      description: "The operator asked the destination to stop starting sync passes.",
    })
  )
) {}

/**
 * The operator asked a paused destination to accept sync passes again.
 *
 * @category models
 * @since 0.0.0
 */
// fallow-ignore-next-line unused-export -- a member of the exported VaultSyncAction union; declaration emit names it in the submit atom's type (TS2527 otherwise). Owner: @beep/professional-desktop. Exit: remove when a consumer imports it directly.
export class ResumeAction extends S.Opaque<ResumeAction, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("resume") }).pipe(
    $I.annoteSchema("ResumeAction", {
      description: "The operator asked a paused destination to accept sync passes again.",
    })
  )
) {}

/**
 * The operator marked one open drift conflict as reviewed.
 *
 * @category models
 * @since 0.0.0
 */
// fallow-ignore-next-line unused-export -- a member of the exported VaultSyncAction union; declaration emit names it in the submit atom's type (TS2527 otherwise). Owner: @beep/professional-desktop. Exit: remove when a consumer imports it directly.
export class ReviewConflictAction extends S.Opaque<ReviewConflictAction, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("review-conflict"),
    conflictId: V.ConflictId,
    remoteEventId: S.NonEmptyString,
    workspaceId: S.Int,
    healOperationId: V.OperationId,
  }).pipe(
    $I.annoteSchema("ReviewConflictAction", {
      description: "The operator marked one open drift conflict as reviewed.",
    })
  )
) {}

/**
 * Commands the vault-sync panel can queue while the sidecar is unreachable.
 *
 * **Example** (Read the queued kinds)
 *
 * ```ts
 * import { VaultSyncActionKind } from "@/sync/VaultSyncIntent.model"
 *
 * console.log(VaultSyncActionKind.literals.length) // 5
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const VaultSyncActionKind = LiteralKit(["request-sync", "probe", "pause", "resume", "review-conflict"]).pipe(
  $I.annoteSchema("VaultSyncActionKind", {
    description: "Operator commands the vault-sync panel predicts and queues.",
  })
);

/**
 * Runtime type for {@link VaultSyncActionKind}.
 *
 * @category models
 * @since 0.0.0
 */
export type VaultSyncActionKind = typeof VaultSyncActionKind.Type;

/**
 * What the operator asked for, without the identity the queue assigns.
 *
 * **Example** (Build a pause action)
 *
 * ```ts
 * import { VaultSyncAction } from "@/sync/VaultSyncIntent.model"
 *
 * console.log(VaultSyncAction.cases.pause.make({}).kind) // "pause"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const VaultSyncAction = VaultSyncActionKind.mapMembers(
  Tuple.evolve([
    () => RequestSyncAction,
    () => ProbeAction,
    () => PauseAction,
    () => ResumeAction,
    () => ReviewConflictAction,
  ])
).pipe(
  $I.annoteSchema("VaultSyncAction", {
    description: "One operator vault-sync command before the queue assigns its identity.",
  }),
  S.toTaggedUnion("kind")
);

/**
 * Runtime type for {@link VaultSyncAction}.
 *
 * @category models
 * @since 0.0.0
 */
export type VaultSyncAction = typeof VaultSyncAction.Type;

/**
 * One persisted operator intent with the stable command id the server dedupes on.
 *
 * **Details**
 *
 * The command id is allocated once, when the operator acts, and survives reloads, so every replay
 * of the same intent is the same command to the server.
 *
 * **Example** (Build a sync request intent)
 *
 * ```ts
 * import * as V from "@beep/documents-domain/aggregates/VaultSync"
 * import { VaultSyncAction, VaultSyncIntent } from "@/sync/VaultSyncIntent.model"
 *
 * const intent = VaultSyncIntent.make({
 *   commandId: "vault-sync_1",
 *   destinationId: V.DestinationId.make("documents_sync_destination_avault"),
 *   queuedAt: 0,
 *   action: VaultSyncAction.cases["request-sync"].make({}),
 * })
 * console.log(intent.action.kind) // "request-sync"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class VaultSyncIntent extends S.Opaque<VaultSyncIntent, { readonly brand: unique symbol }>()(
  S.Struct({
    commandId: V.RequestToken,
    destinationId: V.DestinationId,
    queuedAt: S.Finite,
    action: VaultSyncAction,
  }).pipe(
    $I.annoteSchema("VaultSyncIntent", {
      description: "A persisted operator intent replayed in order with its stable command id.",
    })
  )
) {}

/**
 * The persisted FIFO of intents waiting for the sidecar.
 *
 * **Example** (Decode an empty queue)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { VaultSyncIntentQueue } from "@/sync/VaultSyncIntent.model"
 *
 * console.log(S.decodeUnknownSync(VaultSyncIntentQueue)([])) // []
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const VaultSyncIntentQueue = S.Array(VaultSyncIntent).pipe(
  $I.annoteSchema("VaultSyncIntentQueue", {
    description: "Ordered operator intents not yet answered by the sidecar.",
  })
);

/**
 * Runtime type for {@link VaultSyncIntentQueue}.
 *
 * @category models
 * @since 0.0.0
 */
export type VaultSyncIntentQueue = typeof VaultSyncIntentQueue.Type;

/**
 * Who refused an intent: the local prediction or the sidecar's authoritative decide.
 *
 * @category models
 * @since 0.0.0
 */
const VaultSyncRefusalSource = LiteralKit(["predicted", "server"]).pipe(
  $I.annoteSchema("VaultSyncRefusalSource", {
    description: "Whether the local prediction or the server refused an intent.",
  })
);

/**
 * Runtime type for {@link VaultSyncRefusalSource}.
 *
 * @category models
 * @since 0.0.0
 */
type VaultSyncRefusalSource = typeof VaultSyncRefusalSource.Type;

/**
 * The typed reason an intent was refused: a domain rule or a session denial.
 *
 * @category models
 * @since 0.0.0
 */
export const VaultSyncRefusalReason = S.Union([V.SyncRuleViolation, V.ScopeDenied]).pipe(
  $I.annoteSchema("VaultSyncRefusalReason", {
    description: "A vault sync rule violation or a session scope denial.",
  })
);

/**
 * Runtime type for {@link VaultSyncRefusalReason}.
 *
 * @category models
 * @since 0.0.0
 */
export type VaultSyncRefusalReason = typeof VaultSyncRefusalReason.Type;

/**
 * An intent that will not run, with the typed rejection that refused it.
 *
 * **Details**
 *
 * A server refusal removes the intent from the queue, which reverts its prediction: the panel's
 * predicted state is always the server state folded with the intents still queued.
 *
 * **Example** (Record a server refusal)
 *
 * ```ts
 * import * as V from "@beep/documents-domain/aggregates/VaultSync"
 * import { VaultSyncRefusal } from "@/sync/VaultSyncIntent.model"
 *
 * const refusal = VaultSyncRefusal.make({
 *   commandId: "vault-sync_1",
 *   intentKind: "request-sync",
 *   source: "server",
 *   reason: V.SyncRuleViolation.make({ rule: "destination-paused", evidence: "destination state" }),
 * })
 * console.log(refusal.source) // "server"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class VaultSyncRefusal extends S.Opaque<VaultSyncRefusal, { readonly brand: unique symbol }>()(
  S.Struct({
    commandId: V.RequestToken,
    intentKind: VaultSyncActionKind,
    source: VaultSyncRefusalSource,
    reason: VaultSyncRefusalReason,
  }).pipe(
    $I.annoteSchema("VaultSyncRefusal", {
      description: "A refused vault-sync intent and its typed rejection.",
    })
  )
) {}

/**
 * Whether the sidecar answered the last call.
 *
 * @category models
 * @since 0.0.0
 */
const VaultSyncLink = LiteralKit(["online", "offline"]).pipe(
  $I.annoteSchema("VaultSyncLink", {
    description: "Reachability of the vault-sync Api from the renderer.",
  })
);

/**
 * Runtime type for {@link VaultSyncLink}.
 *
 * @category models
 * @since 0.0.0
 */
export type VaultSyncLink = typeof VaultSyncLink.Type;
