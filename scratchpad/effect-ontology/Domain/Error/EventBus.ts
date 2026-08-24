/**
 * Schema-backed event-bus, Pub/Sub, and dead-letter failures.
 *
 * **Details**
 *
 * * Operational defects decode to `Option`, and exhausted retry counts are
 * constrained to finite non-negative integers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import { NonNegativeInt } from "@beep/schema";
import * as S from "effect/Schema";
import { ErrorMessage, OptionalErrorCause } from "./Base.ts";

const $I = $ScratchpadId.create("effect-ontology/Domain/Error/EventBus");

/**
 * Failure raised by a generic event-bus operation.
 *
 * **Example** (Use EventBusError)
 * ```ts
 * import { EventBusError } from "@effect-ontology/Error/EventBus"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const error = S.decodeUnknownOption(EventBusError)({
 *   _tag: "EventBusError", method: "publish", message: "Publish failed." })
 * console.log(O.isSome(error)) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class EventBusError extends S.TaggedError<EventBusError>($I`EventBusError`)(
  "EventBusError",
  {
    method: S.NonEmptyString.annotateKey({
      description: "Event-bus method that failed.",
    }),
    message: ErrorMessage.annotateKey({
      description: "Human-readable event-bus diagnostic.",
    }),
    cause: OptionalErrorCause.annotateKey({
      description: "Optional event-bus adapter defect.",
    }),
  },
  $I.annote("EventBusError", {
    description: "Failure raised by a generic event-bus operation.",
  })
) {}

/**
 * Failure raised by a Cloud Pub/Sub topic operation.
 *
 * **Example** (Use PubSubError)
 * ```ts
 * import { PubSubError } from "@effect-ontology/Error/EventBus"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const error = S.decodeUnknownOption(PubSubError)({
 *   _tag: "PubSubError",
 *   method: "publish",
 *   topic: "ontology-events",
 *   message: "Broker rejected the message."
 * })
 * console.log(O.isSome(error)) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class PubSubError extends S.TaggedError<PubSubError>($I`PubSubError`)(
  "PubSubError",
  {
    method: S.NonEmptyString.annotateKey({
      description: "Pub/Sub method that failed.",
    }),
    topic: S.NonEmptyString.annotateKey({
      description: "Pub/Sub topic involved in the failure.",
    }),
    message: ErrorMessage.annotateKey({
      description: "Human-readable Pub/Sub diagnostic.",
    }),
    cause: OptionalErrorCause.annotateKey({
      description: "Optional Pub/Sub client defect.",
    }),
  },
  $I.annote("PubSubError", {
    description: "Failure raised by a Cloud Pub/Sub topic operation.",
  })
) {}

/**
 * Indicates that a queued job exhausted its retry budget.
 *
 * **Example** (Use DeadLetterError)
 * ```ts
 * import { DeadLetterError } from "@effect-ontology/Error/EventBus"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * import { NonNegativeInt } from "@beep/schema"
 *
 * const error = S.decodeUnknownOption(DeadLetterError)({
 *   _tag: "DeadLetterError",
 *   jobId: "job-42",
 *   jobType: "EmbedDocument",
 *   attempts: NonNegativeInt.make(3),
 *   lastError: "Provider unavailable."
 * })
 * console.log(O.isSome(error)) // true
 * ```
 *
 * @invariant `attempts` is a finite non-negative integer.
 * @category errors
 * @since 0.0.0
 */
export class DeadLetterError extends S.TaggedError<DeadLetterError>($I`DeadLetterError`)(
  "DeadLetterError",
  {
    jobId: S.NonEmptyString.annotateKey({
      description: "Identifier of the dead-lettered job.",
    }),
    jobType: S.NonEmptyString.annotateKey({
      description: "Stable job type that exhausted retries.",
    }),
    attempts: NonNegativeInt.annotateKey({
      description: "Number of completed delivery attempts.",
    }),
    lastError: ErrorMessage.annotateKey({
      description: "Diagnostic from the final failed attempt.",
    }),
  },
  $I.annote("DeadLetterError", {
    description: "Queued job failure after exhausting its retry budget.",
  })
) {}

const AnyEventBusErrorDefinition = S.Union([EventBusError, PubSubError, DeadLetterError]).pipe(S.toTaggedUnion("_tag"));

/**
 * Exhaustive tagged union of event-bus failures.
 *
 * **Example** (Use AnyEventBusError)
 * ```ts
 * import { AnyEventBusError, EventBusError } from "@effect-ontology/Error/EventBus"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const error = S.decodeUnknownOption(EventBusError)({
 *   _tag: "EventBusError", method: "publish", message: "Failed." })
 * console.log(AnyEventBusError.guards.EventBusError(error)) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const AnyEventBusError = AnyEventBusErrorDefinition.pipe(
  $I.annoteSchema("AnyEventBusError", {
    description: "Exhaustive tagged union of event-bus, Pub/Sub, and dead-letter failures.",
    toArbitrary: () => S.toArbitrary(AnyEventBusErrorDefinition),
  })
);

/**
 * Runtime failure decoded by {@link AnyEventBusError}.
 *
 * **Example** (Use AnyEventBusError)
 * ```ts
 * import { EventBusError, type AnyEventBusError } from "@effect-ontology/Error/EventBus"
 *
 * const error: AnyEventBusError = EventBusError.make({ method: "publish", message: "Failed." })
 * console.log(error._tag)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type AnyEventBusError = typeof AnyEventBusError.Type;
