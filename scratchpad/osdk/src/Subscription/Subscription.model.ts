/**
 * The object-set subscription protocol as data: what a client sends over the websocket and what the server sends back.
 *
 * **Details**
 *
 * OSDK keeps this protocol inside two socket classes, so its rules exist only
 * as control flow. Here every message is a schema: the subscribe request that
 * restates all live subscriptions, the four kinds of {@link StreamMessage} the
 * server sends, the three per-request answers of {@link SubscribeResponse},
 * the two kinds of {@link ObjectSetUpdate} and the two causes a subscription
 * closes for. A transport then only frames JSON, and a state machine is a
 * fold over decoded values.
 *
 * Two identifier spaces run through the protocol. A {@link RequestId} names
 * one subscribe message and pairs it with its answer. A {@link SubscriptionId}
 * names one live subscription and addresses every later message about it.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit, MappedLiteralKit } from "@beep/schema";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Tuple from "effect/Tuple";
import {
  ErrorName,
  FoundryBranch,
  ObjectTypeApiName,
  OntologyScenarioRid,
  PropertyApiName,
} from "../Identifier/Identifier.model.ts";
import { OntologyObject } from "../Object/Object.model.ts";
import { ObjectSet } from "../ObjectSet/ObjectSet.model.ts";
import { GeotimeSeriesValue } from "../TimeSeries/TimeSeries.model.ts";

const $I = $ScratchpadId.create("osdk/Subscription/Subscription.model");

// -----------------------------------------------------------------------------
// Identifiers
// -----------------------------------------------------------------------------

/**
 * Identifier a client gives one subscribe message so the server's answer can name it.
 *
 * @category identifiers
 * @since 0.0.0
 */
export const RequestId = S.NonEmptyString.pipe(
  S.brand("RequestId"),
  $I.annoteSchema("RequestId", {
    description: "Identifier a client gives one subscribe message so the server's answer can name it.",
  })
);

/**
 * Runtime type of {@link RequestId}.
 *
 * @category identifiers
 * @since 0.0.0
 */
export type RequestId = typeof RequestId.Type;

/**
 * Identifier the server gives one live subscription; every later message about the subscription carries it.
 *
 * @category identifiers
 * @since 0.0.0
 */
export const SubscriptionId = S.NonEmptyString.pipe(
  S.brand("SubscriptionId"),
  $I.annoteSchema("SubscriptionId", {
    description: "Identifier the server gives one live subscription.",
  })
);

/**
 * Runtime type of {@link SubscriptionId}.
 *
 * @category identifiers
 * @since 0.0.0
 */
export type SubscriptionId = typeof SubscriptionId.Type;

/**
 * A primary key written as a record from each key property's name to its value.
 *
 * **Details**
 *
 * Streams use this spelling instead of the bare key value of an object
 * locator, so the name of the key property travels with it. The wire leaves
 * the values untyped; they are kept as JSON. Object types have one key
 * property in practice, but the wire does not promise it, so neither does this
 * schema.
 *
 * **Example** (Keep the key property's name beside its value)
 *
 * ```ts import.meta.vitest name="Keep the key property's name beside its value"
 * import * as Effect from "effect/Effect"
 * import * as R from "effect/Record"
 * import * as S from "effect/Schema"
 * import { PrimaryKeyRecord } from "@beep/scratchpad/osdk/src/Subscription/index"
 *
 * const key = await Effect.runPromise(S.decodeUnknownEffect(PrimaryKeyRecord)({ employeeId: 50030 }))
 * R.toEntries(key) // => [["employeeId", 50030]]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PrimaryKeyRecord = S.Record(PropertyApiName, S.Json).pipe(
  $I.annoteSchema("PrimaryKeyRecord", {
    description: "A primary key written as a record from each key property's name to its value.",
  })
);

/**
 * Runtime type of {@link PrimaryKeyRecord}.
 *
 * @category models
 * @since 0.0.0
 */
export type PrimaryKeyRecord = typeof PrimaryKeyRecord.Type;

// -----------------------------------------------------------------------------
// Client to server
// -----------------------------------------------------------------------------

/**
 * Optional features of the objects a subscription delivers.
 *
 * **Details**
 *
 * OSDK always sends `shouldLoadObjectRids: true` and ignores its own
 * `includeRid` option; nothing in the protocol requires that.
 *
 * @category models
 * @since 0.0.0
 */
export class ObjectLoadingOptions extends S.Opaque<ObjectLoadingOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    shouldLoadObjectRids: S.OptionFromOptionalKey(S.Boolean).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({
        description: "Whether delivered objects carry their resource identifier; absent lets the platform choose.",
      })
    ),
  }).pipe(
    $I.annoteSchema("ObjectLoadingOptions", {
      description: "Optional features of the objects a subscription delivers.",
    })
  )
) {}

/**
 * One object set a client wants to watch, and which of its properties to deliver.
 *
 * **Details**
 *
 * `propertySet` names the properties delivered inside object updates.
 * `referenceSet` names the geotime series reference properties whose
 * dereferenced values arrive as separate reference updates. OSDK derives both
 * from one list of requested properties by looking at each property's type,
 * and drops names the object type does not declare.
 *
 * `branch` and `scenarioRid` address a non-default view of the ontology. When
 * a scenario is based on a non-default branch, `branch` must name that base
 * branch.
 *
 * @category models
 * @since 0.0.0
 */
export class ObjectSetSubscribeRequest extends S.Opaque<ObjectSetSubscribeRequest, { readonly brand: unique symbol }>()(
  S.Struct({
    objectSet: ObjectSet.annotateKey({ description: "The object set to watch." }),
    branch: S.OptionFromOptionalKey(FoundryBranch).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Branch whose view of the ontology to watch, absent for the default branch." })
    ),
    scenarioRid: S.OptionFromOptionalKey(OntologyScenarioRid).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Scenario whose view of the ontology to watch, when there is one." })
    ),
    propertySet: S.Array(PropertyApiName).annotateKey({
      description: "Properties delivered inside object updates.",
    }),
    referenceSet: S.Array(PropertyApiName).annotateKey({
      description: "Geotime series reference properties whose resolved values arrive as reference updates.",
    }),
    objectLoadingResponseOptions: S.OptionFromOptionalKey(ObjectLoadingOptions).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Optional features of the delivered objects." })
    ),
  }).pipe(
    $I.annoteSchema("ObjectSetSubscribeRequest", {
      description: "One object set a client wants to watch, and which of its properties to deliver.",
    })
  )
) {}

/**
 * The message a client sends: the complete list of object sets it wants to be subscribed to from now on.
 *
 * **Details**
 *
 * The message is declarative, not incremental. Every message restates all
 * live subscriptions, and leaving one out unsubscribes it. The same message
 * doubles as the heartbeat: OSDK resends it every 45 seconds while anything is
 * subscribed, and closes the socket 15 seconds after the last subscription
 * ends.
 *
 * The server answers with one {@link SubscribeResponses} message that carries
 * this message's `id` and one response per request, in request order.
 *
 * **Example** (Subscribe to one object set)
 *
 * ```ts import.meta.vitest name="Subscribe to one object set"
 * import * as A from "effect/Array"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { ObjectTypeApiName, PropertyApiName } from "@beep/scratchpad/osdk/src/Identifier/index"
 * import { BaseObjectSet } from "@beep/scratchpad/osdk/src/ObjectSet/index"
 * import {
 *   ObjectSetSubscribeRequest,
 *   ObjectSetSubscribeRequests,
 *   RequestId,
 * } from "@beep/scratchpad/osdk/src/Subscription/index"
 *
 * const message = ObjectSetSubscribeRequests.make({
 *   id: RequestId.make("00000000-0000-0000-0000-000000000001"),
 *   requests: [
 *     ObjectSetSubscribeRequest.make({
 *       objectSet: BaseObjectSet.make({ objectType: ObjectTypeApiName.make("Employee") }),
 *       propertySet: [PropertyApiName.make("fullName")],
 *       referenceSet: [PropertyApiName.make("employeeLocation")],
 *     }),
 *   ],
 * })
 * const wire = await Effect.runPromise(S.encodeEffect(ObjectSetSubscribeRequests)(message))
 * const delivered = A.map(wire.requests, ({ propertySet, referenceSet }) => ({ propertySet, referenceSet }))
 * delivered // => [{ propertySet: ["fullName"], referenceSet: ["employeeLocation"] }]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ObjectSetSubscribeRequests extends S.Opaque<
  ObjectSetSubscribeRequests,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    id: RequestId.annotateKey({ description: "Identifier the answering message repeats." }),
    requests: S.Array(ObjectSetSubscribeRequest).annotateKey({
      description: "Every object set to be subscribed to from now on; the answer follows this order.",
    }),
  }).pipe(
    $I.annoteSchema("ObjectSetSubscribeRequests", {
      description: "The complete list of object sets a client wants to be subscribed to from now on.",
    })
  )
) {}

// -----------------------------------------------------------------------------
// Failures reported over a stream
// -----------------------------------------------------------------------------

/**
 * One named detail of a stream failure.
 *
 * @category models
 * @since 0.0.0
 */
export class StreamFailureArgument extends S.Opaque<StreamFailureArgument, { readonly brand: unique symbol }>()(
  S.Struct({
    name: S.String.annotateKey({ description: "Name of the detail." }),
    value: S.String.annotateKey({ description: "The detail, rendered as text." }),
  }).pipe($I.annoteSchema("StreamFailureArgument", { description: "One named detail of a stream failure." }))
) {}

/**
 * A failure as the subscription streams report it: its name and its named details.
 *
 * **Details**
 *
 * This is the wire's `Error` record. It is not the error body of the HTTP
 * endpoints (`errorCode`, `errorName`, `errorInstanceId`, `parameters`): the
 * streams carry only a name and a list of name and value pairs. The details
 * stay a list because the wire does not promise distinct names.
 *
 * @category models
 * @since 0.0.0
 */
export class StreamFailure extends S.Opaque<StreamFailure, { readonly brand: unique symbol }>()(
  S.Struct({
    error: ErrorName.annotateKey({ description: "Name of the failure." }),
    args: S.Array(StreamFailureArgument).annotateKey({ description: "Named details of the failure, in wire order." }),
  }).pipe(
    $I.annoteSchema("StreamFailure", {
      description: "A failure as the subscription streams report it: its name and its named details.",
    })
  )
) {}

// -----------------------------------------------------------------------------
// Answers to a subscribe message
// -----------------------------------------------------------------------------

const SubscribeResponseKind = LiteralKit(["success", "error", "qos"]);

/**
 * The request was accepted: the subscription is live under the given identifier.
 *
 * @category models
 * @since 0.0.0
 */
export class SubscribeSuccess extends S.Opaque<SubscribeSuccess, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("success"),
    id: SubscriptionId.annotateKey({ description: "Identifier of the live subscription." }),
  }).pipe(
    $I.annoteSchema("SubscribeSuccess", {
      description: "The request was accepted: the subscription is live under the given identifier.",
    })
  )
) {}

/**
 * The request was refused, with the failures that explain why.
 *
 * @category models
 * @since 0.0.0
 */
export class SubscribeFailure extends S.Opaque<SubscribeFailure, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("error"),
    errors: S.Array(StreamFailure).annotateKey({ description: "Why the request was refused." }),
  }).pipe(
    $I.annoteSchema("SubscribeFailure", {
      description: "The request was refused, with the failures that explain why.",
    })
  )
) {}

/**
 * The node cannot serve the request for quality-of-service reasons: retry on another node.
 *
 * @category models
 * @since 0.0.0
 */
export class SubscribeQosRejection extends S.Opaque<SubscribeQosRejection, { readonly brand: unique symbol }>()(
  S.Struct({ type: S.tag("qos") }).pipe(
    $I.annoteSchema("SubscribeQosRejection", {
      description: "The node cannot serve the request for quality-of-service reasons: retry on another node.",
    })
  )
) {}

/**
 * The server's answer to one request of a subscribe message.
 *
 * **Details**
 *
 * What a client does with each case:
 *
 * - `success`: the subscription is live. A first success means "subscribed"; a
 *   success after a reconnect means the client missed updates and must reload
 *   the set. Duplicate requests receive the same subscription identifier.
 * - `error`: the subscription never started and is finished.
 * - `qos`: nothing is wrong with the request. The client drops the socket,
 *   reconnects (OSDK backs off from 1 second to 60, doubling, with jitter) and
 *   sends its subscribe message again.
 *
 * **Example** (Fold the answers to a subscribe message)
 *
 * ```ts import.meta.vitest name="Fold the answers to a subscribe message"
 * import * as A from "effect/Array"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { SubscribeResponse } from "@beep/scratchpad/osdk/src/Subscription/index"
 *
 * const outcome = SubscribeResponse.match({
 *   success: ({ id }) => `live under ${id}`,
 *   error: ({ errors }) => `refused for ${errors.length} reason(s)`,
 *   qos: () => "retry on another node",
 * })
 * const responses = await Effect.runPromise(
 *   S.decodeUnknownEffect(S.Array(SubscribeResponse))([{ type: "success", id: "sub-1" }, { type: "qos" }])
 * )
 * A.map(responses, outcome) // => ["live under sub-1", "retry on another node"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SubscribeResponse = SubscribeResponseKind.mapMembers(() =>
  Tuple.make(SubscribeSuccess, SubscribeFailure, SubscribeQosRejection)
).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("SubscribeResponse", {
    description: "The server's answer to one request of a subscribe message.",
  })
);

/**
 * Runtime type of {@link SubscribeResponse}.
 *
 * @category models
 * @since 0.0.0
 */
export type SubscribeResponse = typeof SubscribeResponse.Type;

// -----------------------------------------------------------------------------
// Updates to a watched object set
// -----------------------------------------------------------------------------

/**
 * What happened to an object relative to a watched object set.
 *
 * **Details**
 *
 * `addedOrUpdated`: the object entered the set, or was already in it and
 * changed. `removed`: the object was deleted or no longer matches the set's
 * definition.
 *
 * **Example** (Decide whether an object is still in the set)
 *
 * ```ts import.meta.vitest name="Decide whether an object is still in the set"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { ObjectState } from "@beep/scratchpad/osdk/src/Subscription/index"
 *
 * const isMember = ObjectState.To.match({ addedOrUpdated: () => true, removed: () => false })
 * const state = await Effect.runPromise(S.decodeUnknownEffect(ObjectState)("ADDED_OR_UPDATED"))
 * isMember(state) // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ObjectState = MappedLiteralKit([
  ["ADDED_OR_UPDATED", "addedOrUpdated"],
  ["REMOVED", "removed"],
]).pipe(
  $I.annoteSchema("ObjectState", {
    description: "What happened to an object relative to a watched object set.",
  })
);

/**
 * Runtime type of {@link ObjectState}.
 *
 * @category models
 * @since 0.0.0
 */
export type ObjectState = typeof ObjectState.Type;

const ReferenceValueKind = LiteralKit(["geotimeSeriesValue"]);

/**
 * The resolved value an external reference points to: today only a geotime series value.
 *
 * **Details**
 *
 * The wire declares this as a union with a single case. Keeping it a union
 * means a second kind of reference becomes a compile error in every match
 * instead of a silent gap.
 *
 * **Example** (Read where a tracked entity is)
 *
 * ```ts import.meta.vitest name="Read where a tracked entity is"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { ReferenceValue } from "@beep/scratchpad/osdk/src/Subscription/index"
 *
 * const value = await Effect.runPromise(
 *   S.decodeUnknownEffect(ReferenceValue)({
 *     type: "geotimeSeriesValue",
 *     position: [102, 0.5],
 *     timestamp: "2021-01-04T05:00:00Z",
 *   })
 * )
 * const longitude = ReferenceValue.match(value, { geotimeSeriesValue: ({ position }) => position[0] })
 * longitude // => 102
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ReferenceValue = ReferenceValueKind.mapMembers(() => Tuple.make(GeotimeSeriesValue)).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("ReferenceValue", {
    description: "The resolved value an external reference points to.",
  })
);

/**
 * Runtime type of {@link ReferenceValue}.
 *
 * @category models
 * @since 0.0.0
 */
export type ReferenceValue = typeof ReferenceValue.Type;

const ObjectSetUpdateKind = LiteralKit(["object", "reference"]);

/**
 * An object entered, changed within, or left the watched object set.
 *
 * **Details**
 *
 * The object carries the properties named in the request's `propertySet`.
 * OSDK additionally deletes the keys named in `referenceSet` from it, because
 * those properties arrive as reference updates.
 *
 * @category models
 * @since 0.0.0
 */
export class ObjectUpdate extends S.Opaque<ObjectUpdate, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("object"),
    object: OntologyObject,
    state: ObjectState.annotateKey({ description: "Whether the object is now in the set or has left it." }),
  }).pipe(
    $I.annoteSchema("ObjectUpdate", {
      description: "An object entered, changed within, or left the watched object set.",
    })
  )
) {}

/**
 * The value behind one object's external reference changed, such as the position of a tracked entity.
 *
 * **Details**
 *
 * The object is named by its type and its primary key record, and `value` is
 * the dereferenced value, not the reference stored in the property. OSDK turns
 * this into a synthetic object update in state `addedOrUpdated` whose only
 * properties are the key and the referenced property. The resource identifier
 * of the object is never available on this path.
 *
 * @category models
 * @since 0.0.0
 */
export class ReferenceUpdate extends S.Opaque<ReferenceUpdate, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("reference"),
    objectType: ObjectTypeApiName.annotateKey({ description: "Object type of the object the reference belongs to." }),
    primaryKey: PrimaryKeyRecord.annotateKey({ description: "Primary key of that object, by key property." }),
    property: PropertyApiName.annotateKey({ description: "The reference property whose value changed." }),
    value: ReferenceValue.annotateKey({ description: "The value the reference now resolves to." }),
  }).pipe(
    $I.annoteSchema("ReferenceUpdate", {
      description: "The value behind one object's external reference changed.",
    })
  )
) {}

/**
 * One change to a watched object set: an object changed, or the value behind an object's reference did.
 *
 * **Details**
 *
 * Within one message OSDK delivers the reference updates before the object
 * updates, whatever their order on the wire.
 *
 * **Example** (Decode an object update)
 *
 * ```ts import.meta.vitest name="Decode an object update"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { ObjectSetUpdate } from "@beep/scratchpad/osdk/src/Subscription/index"
 *
 * const update = await Effect.runPromise(
 *   S.decodeUnknownEffect(ObjectSetUpdate)({
 *     type: "object",
 *     state: "ADDED_OR_UPDATED",
 *     object: { __apiName: "Employee", __primaryKey: 50030, employeeId: 50030 },
 *   })
 * )
 * const summary = ObjectSetUpdate.match(update, {
 *   object: ({ object, state }) => `${object.locator.objectType} ${state}`,
 *   reference: ({ objectType, property }) => `${objectType}.${property} moved`,
 * })
 * summary // => "Employee addedOrUpdated"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ObjectSetUpdate = ObjectSetUpdateKind.mapMembers(() => Tuple.make(ObjectUpdate, ReferenceUpdate)).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("ObjectSetUpdate", {
    description: "One change to a watched object set: an object changed, or the value behind its reference did.",
  })
);

/**
 * Runtime type of {@link ObjectSetUpdate}.
 *
 * @category models
 * @since 0.0.0
 */
export type ObjectSetUpdate = typeof ObjectSetUpdate.Type;

// -----------------------------------------------------------------------------
// Why a subscription closed
// -----------------------------------------------------------------------------

/**
 * A reason for closing a subscription that is not a failure.
 *
 * **Example** (Tell who closed the subscription)
 *
 * ```ts import.meta.vitest name="Tell who closed the subscription"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { ClosureReason } from "@beep/scratchpad/osdk/src/Subscription/index"
 *
 * const closedBy = ClosureReason.To.match({ userClosed: () => "the user", channelClosed: () => "the channel" })
 * const reason = await Effect.runPromise(S.decodeUnknownEffect(ClosureReason)("CHANNEL_CLOSED"))
 * closedBy(reason) // => "the channel"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ClosureReason = MappedLiteralKit([
  ["USER_CLOSED", "userClosed"],
  ["CHANNEL_CLOSED", "channelClosed"],
]).pipe(
  $I.annoteSchema("ClosureReason", {
    description: "A reason for closing a subscription that is not a failure.",
  })
);

/**
 * Runtime type of {@link ClosureReason}.
 *
 * @category models
 * @since 0.0.0
 */
export type ClosureReason = typeof ClosureReason.Type;

const ClosureCauseKind = LiteralKit(["reason", "error"]);

/**
 * The subscription was closed deliberately, by the user or with its channel.
 *
 * @category models
 * @since 0.0.0
 */
export class ClosedForReason extends S.Opaque<ClosedForReason, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("reason"),
    reason: ClosureReason.annotateKey({ description: "Who or what closed the subscription." }),
  }).pipe(
    $I.annoteSchema("ClosedForReason", {
      description: "The subscription was closed deliberately, by the user or with its channel.",
    })
  )
) {}

/**
 * The subscription was closed by a failure it could not recover from.
 *
 * **Details**
 *
 * The wire spreads the failure's `error` and `args` beside the tag; the fields
 * here are those of {@link StreamFailure}.
 *
 * @category models
 * @since 0.0.0
 */
export class ClosedByFailure extends S.Opaque<ClosedByFailure, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("error"),
    error: ErrorName.annotateKey({ description: "Name of the failure." }),
    args: S.Array(StreamFailureArgument).annotateKey({ description: "Named details of the failure, in wire order." }),
  }).pipe(
    $I.annoteSchema("ClosedByFailure", {
      description: "The subscription was closed by a failure it could not recover from.",
    })
  )
) {}

/**
 * Why the server closed a subscription: a deliberate reason, or a failure.
 *
 * **Example** (Explain a closed subscription)
 *
 * ```ts import.meta.vitest name="Explain a closed subscription"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { SubscriptionClosureCause } from "@beep/scratchpad/osdk/src/Subscription/index"
 *
 * const explain = SubscriptionClosureCause.match({
 *   reason: ({ reason }) => `closed: ${reason}`,
 *   error: ({ error, args }) => `failed: ${error} (${args.length} details)`,
 * })
 * const cause = await Effect.runPromise(
 *   S.decodeUnknownEffect(SubscriptionClosureCause)({
 *     type: "error",
 *     error: "ObjectSetNotFound",
 *     args: [{ name: "objectSetRid", value: "ri.object-set.main.object-set.1" }],
 *   })
 * )
 * explain(cause) // => "failed: ObjectSetNotFound (1 details)"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SubscriptionClosureCause = ClosureCauseKind.mapMembers(() =>
  Tuple.make(ClosedForReason, ClosedByFailure)
).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("SubscriptionClosureCause", {
    description: "Why the server closed a subscription: a deliberate reason, or a failure.",
  })
);

/**
 * Runtime type of {@link SubscriptionClosureCause}.
 *
 * @category models
 * @since 0.0.0
 */
export type SubscriptionClosureCause = typeof SubscriptionClosureCause.Type;

// -----------------------------------------------------------------------------
// Server to client
// -----------------------------------------------------------------------------

const StreamMessageKind = LiteralKit([
  "subscribeResponses",
  "objectSetChanged",
  "refreshObjectSet",
  "subscriptionClosed",
]);

/**
 * The answer to one subscribe message: one response per request, in request order.
 *
 * **Details**
 *
 * Pairing is positional. `id` names the subscribe message, and `responses[i]`
 * answers its `requests[i]`; nothing else in a response says which request it
 * belongs to. A client therefore has to remember the requests of every message
 * it has sent and not yet seen answered. Because the subscribe message is
 * resent as a heartbeat, a `success` also arrives for subscriptions that are
 * already live; it is not news about them.
 *
 * The link stream answers its subscribe messages with this same record.
 *
 * @category models
 * @since 0.0.0
 */
export class SubscribeResponses extends S.Opaque<SubscribeResponses, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("subscribeResponses"),
    id: RequestId.annotateKey({ description: "Identifier of the subscribe message being answered." }),
    responses: S.Array(SubscribeResponse).annotateKey({
      description: "One response per request of that message, in request order.",
    }),
  }).pipe(
    $I.annoteSchema("SubscribeResponses", {
      description: "The answer to one subscribe message: one response per request, in request order.",
    })
  )
) {}

/**
 * A batch of changes to one watched object set.
 *
 * @category models
 * @since 0.0.0
 */
export class ObjectSetUpdates extends S.Opaque<ObjectSetUpdates, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("objectSetChanged"),
    id: SubscriptionId.annotateKey({ description: "The subscription the changes belong to." }),
    updates: S.Array(ObjectSetUpdate).annotateKey({ description: "The changes, in wire order." }),
  }).pipe($I.annoteSchema("ObjectSetUpdates", { description: "A batch of changes to one watched object set." }))
) {}

/**
 * Notice that changes of one object type cannot be listed: the client must load the object set again in full.
 *
 * @category models
 * @since 0.0.0
 */
export class RefreshObjectSet extends S.Opaque<RefreshObjectSet, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("refreshObjectSet"),
    id: SubscriptionId.annotateKey({ description: "The subscription that is out of date." }),
    objectType: ObjectTypeApiName.annotateKey({ description: "Object type whose changes could not be listed." }),
  }).pipe(
    $I.annoteSchema("RefreshObjectSet", {
      description: "Notice that changes cannot be listed: the client must load the object set again in full.",
    })
  )
) {}

/**
 * Notice that the server ended a subscription for good.
 *
 * **Details**
 *
 * The link stream closes its subscriptions with this same record.
 *
 * @category models
 * @since 0.0.0
 */
export class SubscriptionClosed extends S.Opaque<SubscriptionClosed, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("subscriptionClosed"),
    id: SubscriptionId.annotateKey({ description: "The subscription that ended." }),
    cause: SubscriptionClosureCause.annotateKey({ description: "Why it ended." }),
  }).pipe(
    $I.annoteSchema("SubscriptionClosed", { description: "Notice that the server ended a subscription for good." })
  )
) {}

/**
 * Everything the server sends over the object-set subscription websocket.
 *
 * **Details**
 *
 * `subscribeResponses` is addressed by request identifier; the other three are
 * addressed by subscription identifier. A message about a subscription the
 * client has already ended is stale and safe to ignore. OSDK treats a message
 * of any other kind as a protocol violation.
 *
 * **Example** (Route a server message)
 *
 * ```ts import.meta.vitest name="Route a server message"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { StreamMessage } from "@beep/scratchpad/osdk/src/Subscription/index"
 *
 * const route = StreamMessage.match({
 *   subscribeResponses: ({ responses }) => `${responses.length} request(s) answered`,
 *   objectSetChanged: ({ updates }) => `${updates.length} change(s)`,
 *   refreshObjectSet: ({ objectType }) => `reload ${objectType}`,
 *   subscriptionClosed: ({ cause }) => `closed by ${cause.type}`,
 * })
 * const message = await Effect.runPromise(
 *   S.decodeUnknownEffect(StreamMessage)({ type: "refreshObjectSet", id: "sub-1", objectType: "Employee" })
 * )
 * route(message) // => "reload Employee"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const StreamMessage = StreamMessageKind.mapMembers(() =>
  Tuple.make(SubscribeResponses, ObjectSetUpdates, RefreshObjectSet, SubscriptionClosed)
).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("StreamMessage", {
    description: "Everything the server sends over the object-set subscription websocket.",
  })
);

/**
 * Runtime type of {@link StreamMessage}.
 *
 * @category models
 * @since 0.0.0
 */
export type StreamMessage = typeof StreamMessage.Type;

// -----------------------------------------------------------------------------
// Client-side lifecycle
// -----------------------------------------------------------------------------

/**
 * Where one subscription stands, as a client tracks it.
 *
 * **Details**
 *
 * The server never sends a status; a client derives it from the messages:
 *
 * - `preparing`: requested, not yet answered.
 * - `subscribed`: answered with `success`.
 * - `reconnecting`: was `subscribed` when the socket dropped or the node
 *   answered `qos`. The next `success` returns it to `subscribed`, and the
 *   client must then reload the set, because updates were missed.
 * - `expired`: treated like `reconnecting` when a `success` arrives; OSDK
 *   declares it and never assigns it.
 * - `done`: ended by the client. Final.
 * - `error`: ended by an `error` response, a `subscriptionClosed` message or a
 *   failing listener. Final.
 *
 * **Example** (Recognise the final states)
 *
 * ```ts import.meta.vitest name="Recognise the final states"
 * import * as A from "effect/Array"
 * import { SubscriptionStatus } from "@beep/scratchpad/osdk/src/Subscription/index"
 *
 * const isFinal = SubscriptionStatus.match({
 *   preparing: () => false,
 *   subscribed: () => false,
 *   reconnecting: () => false,
 *   expired: () => false,
 *   done: () => true,
 *   error: () => true,
 * })
 * A.filter(SubscriptionStatus.literals, isFinal) // => ["done", "error"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SubscriptionStatus = LiteralKit([
  "preparing",
  "subscribed",
  "reconnecting",
  "expired",
  "done",
  "error",
]).pipe(
  $I.annoteSchema("SubscriptionStatus", {
    description: "Where one subscription stands, as a client tracks it.",
  })
);

/**
 * Runtime type of {@link SubscriptionStatus}.
 *
 * @category models
 * @since 0.0.0
 */
export type SubscriptionStatus = typeof SubscriptionStatus.Type;
