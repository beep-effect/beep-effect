/**
 * Granular schema-backed embedding-provider failures.
 *
 * **Details**
 *
 * * Counts and durations are non-negative integers, optional metadata is decoded
 * to `Option`, and the family union supports exhaustive recovery by `_tag`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import { NonNegativeInt } from "@beep/schema";
import * as S from "effect/Schema";
import {
  ErrorMessage,
  Milliseconds,
  OptionalErrorCause,
  OptionalErrorMessage,
  OptionalMilliseconds,
  OptionalNonNegativeInt,
} from "./Base.ts";

const $I = $ScratchpadId.create("effect-ontology/Domain/Error/Embedding");

/**
 * General embedding-provider failure.
 *
 * **Example** (Use EmbeddingError)
 * ```ts
 * import { EmbeddingError } from "@effect-ontology/Error/Embedding"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const error = S.decodeUnknownOption(EmbeddingError)({
 *   _tag: "EmbeddingError", message: "Embedding failed.", provider: "openai" })
 * console.log(O.isSome(error)) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class EmbeddingError extends S.TaggedError<EmbeddingError>($I`EmbeddingError`)(
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
) {
  static readonly is = S.is(this);
}

/**
 * Embedding request rejected because provider quota was exhausted.
 *
 * **Example** (Use EmbeddingRateLimitError)
 * ```ts
 * import { EmbeddingRateLimitError } from "@effect-ontology/Error/Embedding"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const error = S.decodeUnknownOption(EmbeddingRateLimitError)({
 *   _tag: "EmbeddingRateLimitError", message: "Quota exhausted.", provider: "openai" })
 * console.log(O.isSome(error)) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class EmbeddingRateLimitError extends S.TaggedError<EmbeddingRateLimitError>($I`EmbeddingRateLimitError`)(
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
) {}

/**
 * Embedding request that exceeded its configured deadline.
 *
 * **Example** (Use EmbeddingTimeoutError)
 * ```ts
 * import { EmbeddingTimeoutError } from "@effect-ontology/Error/Embedding"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * import { Milliseconds } from "@effect-ontology/Error/Base"
 *
 * const error = S.decodeUnknownOption(EmbeddingTimeoutError)({
 *   _tag: "EmbeddingTimeoutError",
 *   message: "Embedding timed out.",
 *   provider: "openai",
 *   timeoutMs: Milliseconds.make(5_000)
 * })
 * console.log(O.isSome(error)) // true
 * ```
 *
 * @invariant `timeoutMs` is a finite non-negative integer.
 * @category errors
 * @since 0.0.0
 */
export class EmbeddingTimeoutError extends S.TaggedError<EmbeddingTimeoutError>($I`EmbeddingTimeoutError`)(
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
) {}

/**
 * Embedding provider response that could not be validated.
 *
 * **Details**
 *
 * * `response` should contain only a bounded, redacted excerpt.
 *
 * **Example** (Use EmbeddingInvalidResponseError)
 * ```ts
 * import { EmbeddingInvalidResponseError } from "@effect-ontology/Error/Embedding"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const error = S.decodeUnknownOption(EmbeddingInvalidResponseError)({
 *   _tag: "EmbeddingInvalidResponseError",
 *   message: "Vector payload is invalid.",
 *   provider: "openai"
 * })
 * console.log(O.isSome(error)) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class EmbeddingInvalidResponseError extends S.TaggedError<EmbeddingInvalidResponseError>(
  $I`EmbeddingInvalidResponseError`
)(
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
) {}

/**
 * Embedding vector whose dimension differs from the expected dimension.
 *
 * **Example** (Use EmbeddingDimensionMismatchError)
 * ```ts
 * import { EmbeddingDimensionMismatchError } from "@effect-ontology/Error/Embedding"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * import { NonNegativeInt } from "@beep/schema"
 *
 * const error = S.decodeUnknownOption(EmbeddingDimensionMismatchError)({
 *   _tag: "EmbeddingDimensionMismatchError",
 *   message: "Expected 1536 dimensions.",
 *   expected: NonNegativeInt.make(1536),
 *   actual: NonNegativeInt.make(768)
 * })
 * console.log(O.isSome(error)) // true
 * ```
 *
 * @invariant `expected` and `actual` are finite non-negative integers.
 * @category errors
 * @since 0.0.0
 */
export class EmbeddingDimensionMismatchError extends S.TaggedError<EmbeddingDimensionMismatchError>(
  $I`EmbeddingDimensionMismatchError`
)(
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
) {}

/**
 * Embedding input that exceeds the provider token budget.
 *
 * **Example** (Use EmbeddingTokenLimitError)
 * ```ts
 * import { EmbeddingTokenLimitError } from "@effect-ontology/Error/Embedding"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * import { NonNegativeInt } from "@beep/schema"
 *
 * const error = S.decodeUnknownOption(EmbeddingTokenLimitError)({
 *   _tag: "EmbeddingTokenLimitError",
 *   message: "Input is too large.",
 *   provider: "openai",
 *   maxTokens: NonNegativeInt.make(8192)
 * })
 * console.log(O.isSome(error)) // true
 * ```
 *
 * @invariant Token counts are finite non-negative integers.
 * @category errors
 * @since 0.0.0
 */
export class EmbeddingTokenLimitError extends S.TaggedError<EmbeddingTokenLimitError>($I`EmbeddingTokenLimitError`)(
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
) {}

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
 * **Example** (Use AnyEmbeddingError)
 * ```ts
 * import { AnyEmbeddingError, EmbeddingError } from "@effect-ontology/Error/Embedding"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const error = S.decodeUnknownOption(EmbeddingError)({
 *   _tag: "EmbeddingError", message: "Failed.", provider: "provider" })
 * console.log(AnyEmbeddingError.guards.EmbeddingError(error)) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const AnyEmbeddingError = AnyEmbeddingErrorDefinition.pipe(
  $I.annoteSchema("AnyEmbeddingError", {
    description: "Exhaustive tagged union of embedding-operation failures.",
    toArbitrary: () => S.toArbitrary(AnyEmbeddingErrorDefinition),
  })
);

/**
 * Runtime failure decoded by {@link AnyEmbeddingError}.
 *
 * **Example** (Use AnyEmbeddingError)
 * ```ts
 * import { EmbeddingError, type AnyEmbeddingError } from "@effect-ontology/Error/Embedding"
 *
 * const error: AnyEmbeddingError = EmbeddingError.make({ message: "Failed.", provider: "provider" })
 * console.log(error._tag)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type AnyEmbeddingError = typeof AnyEmbeddingError.Type;
