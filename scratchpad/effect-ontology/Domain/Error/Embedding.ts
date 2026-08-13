/**
 * Granular schema-backed embedding-provider failures.
 *
 * @remarks
 * Counts and durations are non-negative integers, optional metadata is decoded
 * to `Option`, and the family union supports exhaustive recovery by `_tag`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import { NonNegativeInt } from "@beep/schema";
import * as S from "effect/Schema";
import {
  ErrorMessage,
  Milliseconds,
  makeOntologyErrorClass,
  OptionalErrorCause,
  OptionalErrorMessage,
  OptionalMilliseconds,
  OptionalNonNegativeInt,
} from "./Base.ts";

const $I = $ScratchpadId.create("effect-ontology/Domain/Error/Embedding");

/**
 * General embedding-provider failure.
 *
 * @example
 * ```ts
 * import { EmbeddingError } from "@effect-ontology/Error/Embedding.ts"
 *
 * const error = EmbeddingError.make({ message: "Embedding failed.", provider: "openai" })
 * console.log(error.provider)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const EmbeddingError = makeOntologyErrorClass(
  $I`EmbeddingError`,
  "EmbeddingError",
  {
    message: ErrorMessage.annotateKey({
      description: "Human-readable embedding diagnostic.",
    }),
    provider: S.NonEmptyString.annotateKey({
      description: "Embedding provider that failed.",
    }),
    cause: OptionalErrorCause.annotateKey({
      description: "Optional provider defect.",
    }),
  },
  $I.annote("EmbeddingError", {
    description: "General embedding-provider failure.",
  })
);

/** Runtime value decoded by {@link EmbeddingError}.
 * @example
 * ```ts
 * import { EmbeddingError, type EmbeddingError as Failure } from "@effect-ontology/Error/Embedding.ts"
 * const error: Failure = EmbeddingError.make({ message: "Failed.", provider: "provider" })
 * ```
 * @category type-level
 * @since 0.0.0
 */
export type EmbeddingError = typeof EmbeddingError.Type;

/**
 * Embedding request rejected because provider quota was exhausted.
 *
 * @example
 * ```ts
 * import { EmbeddingRateLimitError } from "@effect-ontology/Error/Embedding.ts"
 *
 * const error = EmbeddingRateLimitError.make({ message: "Quota exhausted.", provider: "openai" })
 * console.log(error._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const EmbeddingRateLimitError = makeOntologyErrorClass(
  $I`EmbeddingRateLimitError`,
  "EmbeddingRateLimitError",
  {
    message: ErrorMessage.annotateKey({
      description: "Human-readable rate-limit diagnostic.",
    }),
    provider: S.NonEmptyString.annotateKey({
      description: "Embedding provider that rejected the request.",
    }),
    retryAfterMs: OptionalMilliseconds.annotateKey({
      description: "Optional provider-directed retry delay, normalized to Option.",
    }),
  },
  $I.annote("EmbeddingRateLimitError", {
    description: "Embedding request rejected because provider quota was exhausted.",
  })
);

/** Runtime value decoded by {@link EmbeddingRateLimitError}.
 * @example
 * ```ts
 * import { EmbeddingRateLimitError, type EmbeddingRateLimitError as Failure } from "@effect-ontology/Error/Embedding.ts"
 * const error: Failure = EmbeddingRateLimitError.make({ message: "Limited.", provider: "provider" })
 * ```
 * @category type-level
 * @since 0.0.0
 */
export type EmbeddingRateLimitError = typeof EmbeddingRateLimitError.Type;

/**
 * Embedding request that exceeded its configured deadline.
 *
 * @example
 * ```ts
 * import { EmbeddingTimeoutError } from "@effect-ontology/Error/Embedding.ts"
 *
 * const error = EmbeddingTimeoutError.fromUnknown({
 *   message: "Embedding timed out.",
 *   provider: "openai",
 *   timeoutMs: 5_000
 * })
 * console.log(error.timeoutMs)
 * ```
 *
 * @invariant `timeoutMs` is a finite non-negative integer.
 * @category errors
 * @since 0.0.0
 */
export const EmbeddingTimeoutError = makeOntologyErrorClass(
  $I`EmbeddingTimeoutError`,
  "EmbeddingTimeoutError",
  {
    message: ErrorMessage.annotateKey({
      description: "Human-readable timeout diagnostic.",
    }),
    provider: S.NonEmptyString.annotateKey({
      description: "Embedding provider that timed out.",
    }),
    timeoutMs: Milliseconds.annotateKey({
      description: "Configured request deadline in milliseconds.",
    }),
  },
  $I.annote("EmbeddingTimeoutError", {
    description: "Embedding request that exceeded its configured deadline.",
  })
);

/** Runtime value decoded by {@link EmbeddingTimeoutError}.
 * @example
 * ```ts
 * import { EmbeddingTimeoutError, type EmbeddingTimeoutError as Failure } from "@effect-ontology/Error/Embedding.ts"
 * const error: Failure = EmbeddingTimeoutError.fromUnknown({ message: "Timed out.", provider: "p", timeoutMs: 1 })
 * ```
 * @category type-level
 * @since 0.0.0
 */
export type EmbeddingTimeoutError = typeof EmbeddingTimeoutError.Type;

/**
 * Embedding provider response that could not be validated.
 *
 * @remarks
 * `response` should contain only a bounded, redacted excerpt.
 *
 * @example
 * ```ts
 * import { EmbeddingInvalidResponseError } from "@effect-ontology/Error/Embedding.ts"
 *
 * const error = EmbeddingInvalidResponseError.make({
 *   message: "Vector payload is invalid.",
 *   provider: "openai"
 * })
 * console.log(error._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const EmbeddingInvalidResponseError = makeOntologyErrorClass(
  $I`EmbeddingInvalidResponseError`,
  "EmbeddingInvalidResponseError",
  {
    message: ErrorMessage.annotateKey({
      description: "Human-readable response-validation diagnostic.",
    }),
    provider: S.NonEmptyString.annotateKey({
      description: "Provider that returned invalid output.",
    }),
    response: OptionalErrorMessage.annotateKey({
      description: "Optional redacted provider response excerpt, normalized to Option.",
    }),
  },
  $I.annote("EmbeddingInvalidResponseError", {
    description: "Embedding provider response that could not be validated.",
  })
);

/** Runtime value decoded by {@link EmbeddingInvalidResponseError}.
 * @example
 * ```ts
 * import { EmbeddingInvalidResponseError, type EmbeddingInvalidResponseError as Failure } from "@effect-ontology/Error/Embedding.ts"
 * const error: Failure = EmbeddingInvalidResponseError.make({ message: "Invalid.", provider: "p" })
 * ```
 * @category type-level
 * @since 0.0.0
 */
export type EmbeddingInvalidResponseError = typeof EmbeddingInvalidResponseError.Type;

/**
 * Embedding vector whose dimension differs from the expected dimension.
 *
 * @example
 * ```ts
 * import { EmbeddingDimensionMismatchError } from "@effect-ontology/Error/Embedding.ts"
 *
 * const error = EmbeddingDimensionMismatchError.fromUnknown({
 *   message: "Expected 1536 dimensions.",
 *   expected: 1536,
 *   actual: 768
 * })
 * console.log(error.actual)
 * ```
 *
 * @invariant `expected` and `actual` are finite non-negative integers.
 * @category errors
 * @since 0.0.0
 */
export const EmbeddingDimensionMismatchError = makeOntologyErrorClass(
  $I`EmbeddingDimensionMismatchError`,
  "EmbeddingDimensionMismatchError",
  {
    message: ErrorMessage.annotateKey({
      description: "Human-readable dimension-mismatch diagnostic.",
    }),
    expected: NonNegativeInt.annotateKey({
      description: "Vector dimension required by the consumer.",
    }),
    actual: NonNegativeInt.annotateKey({
      description: "Vector dimension returned by the provider.",
    }),
  },
  $I.annote("EmbeddingDimensionMismatchError", {
    description: "Embedding vector whose dimension differs from the expected dimension.",
  })
);

/** Runtime value decoded by {@link EmbeddingDimensionMismatchError}.
 * @example
 * ```ts
 * import { EmbeddingDimensionMismatchError, type EmbeddingDimensionMismatchError as Failure } from "@effect-ontology/Error/Embedding.ts"
 * const error: Failure = EmbeddingDimensionMismatchError.fromUnknown({ message: "Mismatch.", expected: 2, actual: 1 })
 * ```
 * @category type-level
 * @since 0.0.0
 */
export type EmbeddingDimensionMismatchError = typeof EmbeddingDimensionMismatchError.Type;

/**
 * Embedding input that exceeds the provider token budget.
 *
 * @example
 * ```ts
 * import { EmbeddingTokenLimitError } from "@effect-ontology/Error/Embedding.ts"
 *
 * const error = EmbeddingTokenLimitError.fromUnknown({
 *   message: "Input is too large.",
 *   provider: "openai",
 *   maxTokens: 8192
 * })
 * console.log(error.maxTokens)
 * ```
 *
 * @invariant Token counts are finite non-negative integers.
 * @category errors
 * @since 0.0.0
 */
export const EmbeddingTokenLimitError = makeOntologyErrorClass(
  $I`EmbeddingTokenLimitError`,
  "EmbeddingTokenLimitError",
  {
    message: ErrorMessage.annotateKey({
      description: "Human-readable token-limit diagnostic.",
    }),
    provider: S.NonEmptyString.annotateKey({
      description: "Embedding provider enforcing the limit.",
    }),
    maxTokens: NonNegativeInt.annotateKey({
      description: "Maximum input token count accepted by the provider.",
    }),
    actualTokens: OptionalNonNegativeInt.annotateKey({
      description: "Optional observed input token count, normalized to Option.",
    }),
  },
  $I.annote("EmbeddingTokenLimitError", {
    description: "Embedding input that exceeds the provider token budget.",
  })
);

/** Runtime value decoded by {@link EmbeddingTokenLimitError}.
 * @example
 * ```ts
 * import { EmbeddingTokenLimitError, type EmbeddingTokenLimitError as Failure } from "@effect-ontology/Error/Embedding.ts"
 * const error: Failure = EmbeddingTokenLimitError.fromUnknown({ message: "Too large.", provider: "p", maxTokens: 10 })
 * ```
 * @category type-level
 * @since 0.0.0
 */
export type EmbeddingTokenLimitError = typeof EmbeddingTokenLimitError.Type;

const AnyEmbeddingErrorDefinition = S.Union([
  EmbeddingError,
  EmbeddingRateLimitError,
  EmbeddingTimeoutError,
  EmbeddingInvalidResponseError,
  EmbeddingDimensionMismatchError,
  EmbeddingTokenLimitError,
]).pipe(S.toTaggedUnion("_tag"));

/**
 * Exhaustive tagged union of embedding-operation failures.
 *
 * @example
 * ```ts
 * import { AnyEmbeddingError, EmbeddingError } from "@effect-ontology/Error/Embedding.ts"
 *
 * const error = EmbeddingError.make({ message: "Failed.", provider: "provider" })
 * console.log(AnyEmbeddingError.guards.EmbeddingError(error)) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const AnyEmbeddingError = AnyEmbeddingErrorDefinition.pipe(
  $I.annoteSchema("AnyEmbeddingError", {
    description: "Exhaustive tagged union of embedding-operation failures.",
    toArbitrary: () => (fc) => S.toArbitrary(AnyEmbeddingErrorDefinition)(fc),
  })
);

/**
 * Runtime failure decoded by {@link AnyEmbeddingError}.
 *
 * @example
 * ```ts
 * import { EmbeddingError, type AnyEmbeddingError } from "@effect-ontology/Error/Embedding.ts"
 *
 * const error: AnyEmbeddingError = EmbeddingError.make({ message: "Failed.", provider: "provider" })
 * console.log(error._tag)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type AnyEmbeddingError = typeof AnyEmbeddingError.Type;
