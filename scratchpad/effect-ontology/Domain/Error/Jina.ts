/**
 * Schema-backed failures for Jina Reader API operations.
 *
 * @remarks
 * URLs use the repository's canonical URL schema, optional transport metadata
 * becomes `Option`, and safe messages default during schema construction.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import type { TaggedErrorClassFromFields } from "@beep/schema";
import { SchemaUtils, TaggedErrorClass } from "@beep/schema";
import * as Duration from "effect/Duration";
import * as S from "effect/Schema";
import {
  ErrorMessage,
  ErrorUrl,
  Milliseconds,
  makeOntologyErrorClass,
  OptionalErrorCause,
  OptionalErrorUrl,
  OptionalHttpStatusCode,
} from "./Base.ts";

const $I = $ScratchpadId.create("effect-ontology/Domain/Error/Jina");

/**
 * General Jina Reader transport or API response failure.
 *
 * @example
 * ```ts
 * import { JinaApiError } from "@effect-ontology/Error/Jina.ts"
 *
 * const error = JinaApiError.make({ message: "Jina request failed." })
 * console.log(error._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const JinaApiError = makeOntologyErrorClass(
  $I`JinaApiError`,
  "JinaApiError",
  {
    message: ErrorMessage.annotateKey({
      description: "Human-readable Jina API diagnostic.",
    }),
    statusCode: OptionalHttpStatusCode.annotateKey({
      description: "Optional HTTP response status, normalized to Option.",
    }),
    url: OptionalErrorUrl.annotateKey({
      description: "Optional target URL, normalized to Option.",
    }),
    cause: OptionalErrorCause.annotateKey({
      description: "Optional Jina client defect.",
    }),
  },
  $I.annote("JinaApiError", {
    description: "General Jina Reader transport or API response failure.",
  })
);

/** Runtime value decoded by {@link JinaApiError}.
 * @example
 * ```ts
 * import { JinaApiError, type JinaApiError as Failure } from "@effect-ontology/Error/Jina.ts"
 * const error: Failure = JinaApiError.make({ message: "Failed." })
 * ```
 * @category type-level
 * @since 0.0.0
 */
export type JinaApiError = typeof JinaApiError.Type;

const JinaRateLimitErrorFields = {
  retryAfterMs: Milliseconds.annotateKey({
    description: "Provider-directed retry delay in milliseconds.",
  }),
  message: ErrorMessage.pipe(SchemaUtils.withKeyDefaults("Jina API rate limit exceeded")).annotateKey({
    description: "Human-readable rate-limit diagnostic with a schema-owned default.",
  }),
} satisfies S.Struct.Fields;

const makeJinaRateLimitError = (
  input: S.Schema.Type<S.TaggedStruct<"JinaRateLimitError", typeof JinaRateLimitErrorFields>>
): JinaRateLimitError => JinaRateLimitError.make(input as never);

const JinaRateLimitErrorBase: TaggedErrorClassFromFields<
  JinaRateLimitError,
  "JinaRateLimitError",
  typeof JinaRateLimitErrorFields
> = TaggedErrorClass<JinaRateLimitError>($I`JinaRateLimitError`)("JinaRateLimitError", JinaRateLimitErrorFields, {
  ...$I.annote("JinaRateLimitError", {
    description: "Jina Reader request rejected because the API quota was exhausted.",
  }),
  toArbitrary:
    ([from]) =>
    () => ({
      arbitrary: from.arbitrary.map(makeJinaRateLimitError),
      terminal: from.terminal?.map(makeJinaRateLimitError),
    }),
});

/**
 * Jina Reader request rejected because the API quota was exhausted.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { JinaRateLimitError } from "@effect-ontology/Error/Jina.ts"
 *
 * const error = S.decodeUnknownSync(JinaRateLimitError)({ retryAfterMs: 1_000 })
 * console.log(error.retryAfter)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class JinaRateLimitError extends JinaRateLimitErrorBase {
  /**
   * Provider-directed retry delay as an Effect `Duration`.
   *
   * @example
   * ```ts
   * import { JinaRateLimitError } from "@effect-ontology/Error/Jina.ts"
   *
   * console.log(JinaRateLimitError.make({ retryAfterMs: 250 }).retryAfter)
   * ```
   *
   * @returns The schema-owned retry delay as an Effect `Duration`.
   * @category errors
   * @since 0.0.0
   */
  get retryAfter(): Duration.Duration {
    return Duration.millis(this.retryAfterMs);
  }
}

/**
 * Jina Reader response that could not be parsed.
 *
 * @example
 * ```ts
 * import { JinaParseError } from "@effect-ontology/Error/Jina.ts"
 *
 * const error = JinaParseError.make({ message: "Reader response is malformed." })
 * console.log(error._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const JinaParseError = makeOntologyErrorClass(
  $I`JinaParseError`,
  "JinaParseError",
  {
    message: ErrorMessage.annotateKey({
      description: "Human-readable response-parsing diagnostic.",
    }),
    url: OptionalErrorUrl.annotateKey({
      description: "Optional source URL, normalized to Option.",
    }),
    cause: OptionalErrorCause.annotateKey({
      description: "Optional response parser defect.",
    }),
  },
  $I.annote("JinaParseError", {
    description: "Jina Reader response that could not be parsed.",
  })
);

/** Runtime value decoded by {@link JinaParseError}.
 * @example
 * ```ts
 * import { JinaParseError, type JinaParseError as Failure } from "@effect-ontology/Error/Jina.ts"
 * const error: Failure = JinaParseError.make({ message: "Malformed." })
 * ```
 * @category type-level
 * @since 0.0.0
 */
export type JinaParseError = typeof JinaParseError.Type;

/**
 * Jina Reader request that exceeded its configured deadline.
 *
 * @example
 * ```ts
 * import { JinaTimeoutError } from "@effect-ontology/Error/Jina.ts"
 *
 * const error = JinaTimeoutError.fromUnknown({
 *   url: "https://example.com/article",
 *   timeoutMs: 5_000
 * })
 * console.log(error.message)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const JinaTimeoutError = makeOntologyErrorClass(
  $I`JinaTimeoutError`,
  "JinaTimeoutError",
  {
    url: ErrorUrl.annotateKey({
      description: "Canonical source URL whose Jina request timed out.",
    }),
    timeoutMs: Milliseconds.annotateKey({
      description: "Configured Jina request deadline in milliseconds.",
    }),
    message: ErrorMessage.pipe(SchemaUtils.withKeyDefaults("Jina API request timed out")).annotateKey({
      description: "Human-readable timeout diagnostic with a schema-owned default.",
    }),
  },
  $I.annote("JinaTimeoutError", {
    description: "Jina Reader request that exceeded its configured deadline.",
  })
);

/** Runtime value decoded by {@link JinaTimeoutError}.
 * @example
 * ```ts
 * import { JinaTimeoutError, type JinaTimeoutError as Failure } from "@effect-ontology/Error/Jina.ts"
 * const error: Failure = JinaTimeoutError.fromUnknown({ url: "https://example.com/a", timeoutMs: 10 })
 * ```
 * @category type-level
 * @since 0.0.0
 */
export type JinaTimeoutError = typeof JinaTimeoutError.Type;

const JinaErrorDefinition = S.Union([JinaApiError, JinaRateLimitError, JinaParseError, JinaTimeoutError]).pipe(
  S.toTaggedUnion("_tag")
);

/**
 * Exhaustive tagged union of Jina Reader failures.
 *
 * @example
 * ```ts
 * import { JinaError, JinaApiError } from "@effect-ontology/Error/Jina.ts"
 *
 * const error = JinaApiError.make({ message: "Failed." })
 * console.log(JinaError.guards.JinaApiError(error)) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const JinaError = JinaErrorDefinition.pipe(
  $I.annoteSchema("JinaError", {
    description: "Exhaustive tagged union of Jina Reader failures.",
    toArbitrary: () => S.toArbitrary(JinaErrorDefinition),
  })
);

/**
 * Runtime failure decoded by {@link JinaError}.
 *
 * @example
 * ```ts
 * import { JinaApiError, type JinaError } from "@effect-ontology/Error/Jina.ts"
 *
 * const error: JinaError = JinaApiError.make({ message: "Failed." })
 * console.log(error._tag)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type JinaError = typeof JinaError.Type;
