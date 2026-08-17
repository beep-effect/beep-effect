/**
 * Serializable activity failures for durable workflow journals.
 *
 * **Details**
 *
 * * These values are plain tagged records rather than throwable errors because
 * workflow engines persist them. Constructors and conversion helpers live on
 * the schema, while compatibility exports delegate to those statics.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import { SchemaUtils } from "@beep/schema";
import { dual, O, P } from "@beep/utils";
import { Inspectable, Match } from "effect";
import * as S from "effect/Schema";
import { ErrorMessage, Milliseconds, OptionalErrorMessage } from "./Base.ts";

const $I = $ScratchpadId.create("effect-ontology/Domain/Error/Activity");

const ActivityErrorCases = S.TaggedUnion({
  ActivityTimeout: {
    stage: S.NonEmptyString.annotateKey({
      description: "Workflow stage that exceeded its deadline.",
    }),
    durationMs: Milliseconds.annotateKey({
      description: "Elapsed activity duration in milliseconds.",
    }),
    message: ErrorMessage.annotateKey({
      description: "Human-readable timeout diagnostic.",
    }),
  },
  ActivityServiceFailure: {
    service: S.NonEmptyString.annotateKey({
      description: "Service whose operation failed.",
    }),
    operation: S.NonEmptyString.annotateKey({
      description: "Failed service operation.",
    }),
    message: ErrorMessage.annotateKey({
      description: "Human-readable service failure diagnostic.",
    }),
    retryable: S.Boolean.pipe(SchemaUtils.withKeyDefaults(false)).annotateKey({
      description: "Whether workflow retry policy may safely retry the operation.",
    }),
  },
  ActivityNotFound: {
    resourceType: S.NonEmptyString.annotateKey({
      description: "Domain type of the missing resource.",
    }),
    resourceId: S.NonEmptyString.annotateKey({
      description: "Identifier of the missing resource.",
    }),
    message: ErrorMessage.annotateKey({
      description: "Human-readable lookup diagnostic.",
    }),
  },
  ActivityValidation: {
    field: OptionalErrorMessage.annotateKey({
      description: "Optional invalid field name, normalized to Option.",
    }),
    reason: ErrorMessage.annotateKey({
      description: "Stable explanation of the validation failure.",
    }),
    message: ErrorMessage.annotateKey({
      description: "Human-readable validation diagnostic.",
    }),
  },
  ActivityGeneric: {
    message: ErrorMessage.annotateKey({
      description: "Human-readable fallback diagnostic.",
    }),
    cause: OptionalErrorMessage.annotateKey({
      description: "Optional rendered cause, normalized to Option for journaling.",
    }),
  },
});

const ActivityTimeoutErrorDefinition = ActivityErrorCases.cases.ActivityTimeout;

/**
 * Serializable timeout at a named workflow activity stage.
 *
 * **Example** (Use ActivityTimeoutError)
 * ```ts
 * import { Milliseconds } from "@effect-ontology/Error/Base"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { ActivityTimeoutError } from "@effect-ontology/Error/Activity"
 *
 * const error = S.decodeUnknownOption(ActivityTimeoutError)({
 *   _tag: "ActivityTimeoutError",
 *   stage: "enrichment",
 *   durationMs: Milliseconds.make(5_000),
 *   message: "Enrichment timed out."
 * })
 * console.log(O.isSome(error)) // true
 * ```
 *
 * @invariant `durationMs` is a finite non-negative integer.
 * @category errors
 * @since 0.0.0
 */
export const ActivityTimeoutError = ActivityTimeoutErrorDefinition.annotate({
  toArbitrary: () => S.toArbitrary(ActivityTimeoutErrorDefinition),
}).pipe(
  $I.annoteSchema("ActivityTimeoutError", {
    description: "Serializable timeout at a named workflow activity stage.",
  })
);

/**
 * Runtime value decoded by {@link ActivityTimeoutError}.
 *
 * **Example** (Use ActivityTimeoutError)
 * ```ts
 * import { Milliseconds } from "@effect-ontology/Error/Base"
 * import { ActivityTimeoutError, type ActivityTimeoutError as Timeout } from "@effect-ontology/Error/Activity"
 *
 * const error: Timeout = ActivityTimeoutError.make({
 *   stage: "load",
 *   durationMs: Milliseconds.make(100),
 *   message: "Timed out."
 * })
 * console.log(error.stage)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ActivityTimeoutError = typeof ActivityTimeoutError.Type;

const ActivityServiceErrorDefinition = ActivityErrorCases.cases.ActivityServiceFailure;

/**
 * Serializable service-operation failure raised by an activity.
 *
 * **Example** (Use ActivityServiceError)
 * ```ts
 * import { ActivityServiceError } from "@effect-ontology/Error/Activity"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const error = S.decodeUnknownOption(ActivityServiceError)({
 *   _tag: "ActivityServiceError",
 *   service: "JinaReader",
 *   operation: "fetch",
 *   message: "Request failed."
 * })
 * console.log(O.isSome(error)) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const ActivityServiceError = ActivityServiceErrorDefinition.annotate({
  toArbitrary: () => S.toArbitrary(ActivityServiceErrorDefinition),
}).pipe(
  $I.annoteSchema("ActivityServiceError", {
    description: "Serializable service-operation failure raised by a workflow activity.",
  })
);

/**
 * Runtime value decoded by {@link ActivityServiceError}.
 *
 * **Example** (Use ActivityServiceError)
 * ```ts
 * import { ActivityServiceError, type ActivityServiceError as ServiceFailure } from "@effect-ontology/Error/Activity"
 *
 * const error: ServiceFailure = ActivityServiceError.make({
 *   service: "Store",
 *   operation: "put",
 *   message: "Unavailable."
 * })
 * console.log(error.service)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ActivityServiceError = typeof ActivityServiceError.Type;

const ActivityNotFoundErrorDefinition = ActivityErrorCases.cases.ActivityNotFound;

/**
 * Serializable missing-resource failure raised by an activity.
 *
 * **Example** (Use ActivityNotFoundError)
 * ```ts
 * import { ActivityNotFoundError } from "@effect-ontology/Error/Activity"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const error = S.decodeUnknownOption(ActivityNotFoundError)({
 *   _tag: "ActivityNotFoundError",
 *   resourceType: "Document",
 *   resourceId: "doc-42",
 *   message: "Document not found: doc-42"
 * })
 * console.log(O.isSome(error)) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const ActivityNotFoundError = ActivityNotFoundErrorDefinition.annotate({
  toArbitrary: () => S.toArbitrary(ActivityNotFoundErrorDefinition),
}).pipe(
  $I.annoteSchema("ActivityNotFoundError", {
    description: "Serializable missing-resource failure raised by a workflow activity.",
  })
);

/**
 * Runtime value decoded by {@link ActivityNotFoundError}.
 *
 * **Example** (Use ActivityNotFoundError)
 * ```ts
 * import { ActivityNotFoundError, type ActivityNotFoundError as Missing } from "@effect-ontology/Error/Activity"
 *
 * const error: Missing = ActivityNotFoundError.make({
 *   resourceType: "Shape",
 *   resourceId: "shape-1",
 *   message: "Missing."
 * })
 * console.log(error._tag)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ActivityNotFoundError = typeof ActivityNotFoundError.Type;

const ActivityValidationErrorDefinition = ActivityErrorCases.cases.ActivityValidation;

/**
 * Serializable activity-input validation failure.
 *
 * **Example** (Use ActivityValidationError)
 * ```ts
 * import { ActivityValidationError } from "@effect-ontology/Error/Activity"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const error = S.decodeUnknownOption(ActivityValidationError)({
 *   _tag: "ActivityValidationError",
 *   reason: "Expected a non-empty IRI.",
 *   message: "Activity input is invalid."
 * })
 * console.log(O.isSome(error)) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const ActivityValidationError = ActivityValidationErrorDefinition.annotate({
  toArbitrary: () => S.toArbitrary(ActivityValidationErrorDefinition),
}).pipe(
  $I.annoteSchema("ActivityValidationError", {
    description: "Serializable activity-input validation failure.",
  })
);

/**
 * Runtime value decoded by {@link ActivityValidationError}.
 *
 * **Example** (Use ActivityValidationError)
 * ```ts
 * import { ActivityValidationError, type ActivityValidationError as Invalid } from "@effect-ontology/Error/Activity"
 *
 * const error: Invalid = ActivityValidationError.make({
 *   reason: "Invalid value.",
 *   message: "Validation failed."
 * })
 * console.log(error.reason)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ActivityValidationError = typeof ActivityValidationError.Type;

const ActivityGenericErrorDefinition = ActivityErrorCases.cases.ActivityGeneric;

/**
 * Serializable fallback for an otherwise unclassified activity failure.
 *
 * **Example** (Use ActivityGenericError)
 * ```ts
 * import { ActivityGenericError } from "@effect-ontology/Error/Activity"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const error = S.decodeUnknownOption(ActivityGenericError)({
 *   _tag: "ActivityGenericError", message: "Unexpected activity failure." })
 * console.log(O.isSome(error)) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const ActivityGenericError = ActivityGenericErrorDefinition.annotate({
  toArbitrary: () => S.toArbitrary(ActivityGenericErrorDefinition),
}).pipe(
  $I.annoteSchema("ActivityGenericError", {
    description: "Serializable fallback for an otherwise unclassified activity failure.",
  })
);

/**
 * Runtime value decoded by {@link ActivityGenericError}.
 *
 * **Example** (Use ActivityGenericError)
 * ```ts
 * import { ActivityGenericError, type ActivityGenericError as GenericFailure } from "@effect-ontology/Error/Activity"
 *
 * const error: GenericFailure = ActivityGenericError.make({ message: "Unexpected." })
 * console.log(error.message)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ActivityGenericError = typeof ActivityGenericError.Type;

const messageFromUnknown = Match.type<unknown>().pipe(
  Match.when(P.isError, (error) =>
    Match.value(error.message).pipe(
      Match.when(ErrorMessage.is, (message) => message),
      Match.orElse(() => ErrorMessage.make(Inspectable.toStringUnknown(error, 0)))
    )
  ),
  Match.orElse((value) => ErrorMessage.make(Inspectable.toStringUnknown(value, 0)))
);

const causeFromUnknown = Match.type<unknown>().pipe(
  Match.withReturnType<O.Option<ErrorMessage>>(),
  Match.when(P.isError, (error) => O.fromNullishOr(error.cause).pipe(O.map(messageFromUnknown))),
  Match.orElse(() => O.none<ErrorMessage>())
);

const makeGeneric = (input: unknown): ActivityGenericError =>
  ActivityGenericError.make({
    message: messageFromUnknown(input),
    cause: causeFromUnknown(input),
  });

const makeServiceFailure: {
  (service: string, operation: string, input: unknown, retryable: boolean): ActivityServiceError;
  (operation: string, input: unknown, retryable: boolean): (service: string) => ActivityServiceError;
} = dual(
  4,
  (service: string, operation: string, input: unknown, retryable: boolean): ActivityServiceError =>
    ActivityServiceError.make({
      service,
      operation,
      message: messageFromUnknown(input),
      retryable,
    })
);

const makeNotFound: {
  (resourceType: string, resourceId: string): ActivityNotFoundError;
  (resourceId: string): (resourceType: string) => ActivityNotFoundError;
} = dual(
  2,
  (resourceType: string, resourceId: string): ActivityNotFoundError =>
    ActivityNotFoundError.make({
      resourceType,
      resourceId,
      message: `${resourceType} not found: ${resourceId}`,
    })
);

const ActivityErrorDefinition = S.Union([
  ActivityTimeoutError,
  ActivityServiceError,
  ActivityNotFoundError,
  ActivityValidationError,
  ActivityGenericError,
]).pipe(S.toTaggedUnion("_tag"));

/**
 * Exhaustive journal-safe tagged union of workflow activity failures.
 *
 * **Details**
 *
 * * The companion constructors centralize unknown-error rendering and defaults;
 * downstream workflow code can use `.match`, `.guards`, and `.cases`.
 *
 * **Example** (Use ActivityError)
 * ```ts
 * import { ActivityError } from "@effect-ontology/Error/Activity"
 *
 * const error = ActivityError.generic("boom")
 * console.log(ActivityError.guards.ActivityGeneric(error)) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const ActivityError = ActivityErrorDefinition.pipe(
  $I.annoteSchema("ActivityError", {
    description: "Exhaustive journal-safe tagged union of workflow activity failures.",
    toArbitrary: () => S.toArbitrary(ActivityErrorDefinition),
  }),
  SchemaUtils.withStatics(() => ({
    generic: makeGeneric,
    serviceFailure: makeServiceFailure,
    notFound: makeNotFound,
  }))
);

/**
 * Runtime failure decoded by {@link ActivityError}.
 *
 * **Example** (Use ActivityError)
 * ```ts
 * import { ActivityError, type ActivityError as ActivityFailure } from "@effect-ontology/Error/Activity"
 *
 * const error: ActivityFailure = ActivityError.notFound("Document", "doc-42")
 * console.log(error._tag)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ActivityError = typeof ActivityError.Type;

/**
 * Converts an unknown failure into a journal-safe generic activity error.
 *
 * **Example** (Use toActivityError)
 * ```ts
 * import { toActivityError } from "@effect-ontology/Error/Activity"
 *
 * console.log(toActivityError("boom").message)
 * ```
 *
 * @param input - Unknown failure caught at an activity boundary.
 * @returns A serializable `ActivityGeneric` value with normalized cause text.
 * @category constructors
 * @since 0.0.0
 */
export const toActivityError = ActivityError.generic;

/**
 * Constructs a journal-safe service-operation activity failure.
 *
 * **Example** (Use serviceError)
 * ```ts
 * import { serviceError } from "@effect-ontology/Error/Activity"
 *
 * const error = serviceError("Store", "put", "offline", true)
 * console.log(error.retryable)
 * ```
 *
 * @param service - Non-empty service name.
 * @param operation - Non-empty failed operation name.
 * @param input - Unknown failure caught at the service boundary.
 * @param retryable - Whether workflow retry policy may safely retry.
 * @returns A serializable `ActivityServiceFailure` value.
 * @throws A schema error when `service` or `operation` is empty.
 * @category constructors
 * @since 0.0.0
 */
export const serviceError = ActivityError.serviceFailure;

/**
 * Constructs a journal-safe missing-resource activity failure.
 *
 * **Example** (Use notFoundError)
 * ```ts
 * import { notFoundError } from "@effect-ontology/Error/Activity"
 *
 * console.log(notFoundError("Document", "doc-42").message)
 * ```
 *
 * @param resourceType - Non-empty domain resource type.
 * @param resourceId - Non-empty missing resource identifier.
 * @returns A serializable `ActivityNotFound` value.
 * @throws A schema error when `resourceType` or `resourceId` is empty.
 * @category constructors
 * @since 0.0.0
 */
export const notFoundError = ActivityError.notFound;
