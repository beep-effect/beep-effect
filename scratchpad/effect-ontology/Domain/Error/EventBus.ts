/**
 * Schema-backed event-bus, Pub/Sub, and dead-letter failures.
 *
 * @remarks
 * Operational defects decode to `Option`, and exhausted retry counts are
 * constrained to finite non-negative integers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import { NonNegativeInt } from "@beep/schema";
import * as S from "effect/Schema";
import { ErrorMessage, makeOntologyErrorClass, OptionalErrorCause } from "./Base.ts";

const $I = $ScratchpadId.create("effect-ontology/Domain/Error/EventBus");

/**
 * Failure raised by a generic event-bus operation.
 *
 * @example
 * ```ts
 * import { EventBusError } from "@effect-ontology/Error/EventBus.ts"
 *
 * const error = EventBusError.make({ method: "publish", message: "Publish failed." })
 * console.log(error.method)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const EventBusError = makeOntologyErrorClass.make(
  $I`EventBusError`,
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
);

/**
 * Runtime value decoded by {@link EventBusError}.
 *
 * @example
 * ```ts
 * import { EventBusError, type EventBusError as Failure } from "@effect-ontology/Error/EventBus.ts"
 *
 * const error: Failure = EventBusError.make({ method: "publish", message: "Failed." })
 * console.log(error._tag)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type EventBusError = typeof EventBusError.Type;

/**
 * Failure raised by a Cloud Pub/Sub topic operation.
 *
 * @example
 * ```ts
 * import { PubSubError } from "@effect-ontology/Error/EventBus.ts"
 *
 * const error = PubSubError.make({
 *   method: "publish",
 *   topic: "ontology-events",
 *   message: "Broker rejected the message."
 * })
 * console.log(error.topic)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const PubSubError = makeOntologyErrorClass.make(
  $I`PubSubError`,
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
);

/**
 * Runtime value decoded by {@link PubSubError}.
 *
 * @example
 * ```ts
 * import { PubSubError, type PubSubError as Failure } from "@effect-ontology/Error/EventBus.ts"
 *
 * const error: Failure = PubSubError.make({
 *   method: "publish",
 *   topic: "events",
 *   message: "Failed."
 * })
 * console.log(error.topic)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type PubSubError = typeof PubSubError.Type;

/**
 * Indicates that a queued job exhausted its retry budget.
 *
 * @example
 * ```ts
 * import { DeadLetterError } from "@effect-ontology/Error/EventBus.ts"
 *
 * const error = DeadLetterError.fromUnknown({
 *   jobId: "job-42",
 *   jobType: "EmbedDocument",
 *   attempts: 3,
 *   lastError: "Provider unavailable."
 * })
 * console.log(error.attempts)
 * ```
 *
 * @invariant `attempts` is a finite non-negative integer.
 * @category errors
 * @since 0.0.0
 */
export const DeadLetterError = makeOntologyErrorClass.make(
  $I`DeadLetterError`,
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
);

/**
 * Runtime value decoded by {@link DeadLetterError}.
 *
 * @example
 * ```ts
 * import { DeadLetterError, type DeadLetterError as DeadLetter } from "@effect-ontology/Error/EventBus.ts"
 *
 * const error: DeadLetter = DeadLetterError.fromUnknown({
 *   jobId: "job-1",
 *   jobType: "Load",
 *   attempts: 1,
 *   lastError: "Failed."
 * })
 * console.log(error.jobId)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type DeadLetterError = typeof DeadLetterError.Type;

const AnyEventBusErrorDefinition = S.Union([EventBusError, PubSubError, DeadLetterError]).pipe(S.toTaggedUnion("_tag"));

/**
 * Exhaustive tagged union of event-bus failures.
 *
 * @example
 * ```ts
 * import { AnyEventBusError, EventBusError } from "@effect-ontology/Error/EventBus.ts"
 *
 * const error = EventBusError.make({ method: "publish", message: "Failed." })
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
 * @example
 * ```ts
 * import { EventBusError, type AnyEventBusError } from "@effect-ontology/Error/EventBus.ts"
 *
 * const error: AnyEventBusError = EventBusError.make({ method: "publish", message: "Failed." })
 * console.log(error._tag)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type AnyEventBusError = typeof AnyEventBusError.Type;
