/**
 * Schema-backed failures for Jina Reader API operations.
 *
 * **Details**
 *
 * * URLs use the repository's canonical URL schema, optional transport metadata
 * becomes `Option`, and safe messages default during schema construction.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import { SchemaUtils, URLStr } from "@beep/schema";
import { Duration } from "effect";
import * as S from "effect/Schema";
import { ErrorMessage, Milliseconds, OptionalErrorCause, OptionalErrorUrl, OptionalHttpStatusCode } from "./Base.ts";

const $I = $ScratchpadId.create("effect-ontology/Domain/Error/Jina");

/**
 * General Jina Reader transport or API response failure.
 *
 * **Example** (Use JinaApiError)
 * ```ts
 * import { JinaApiError } from "@effect-ontology/Error/Jina"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const error = S.decodeUnknownOption(JinaApiError)({
 *   _tag: "JinaApiError", message: "Jina request failed." })
 * console.log(O.isSome(error)) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class JinaApiError extends S.TaggedError<JinaApiError>($I`JinaApiError`)(
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
) {}

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
): JinaRateLimitError => JinaRateLimitError.make(input);

const JinaRateLimitErrorBase = S.TaggedError<JinaRateLimitError>($I`JinaRateLimitError`)(
  "JinaRateLimitError",
  JinaRateLimitErrorFields,
  {
    ...$I.annote("JinaRateLimitError", {
      description: "Jina Reader request rejected because the API quota was exhausted.",
    }),
    toArbitrary:
      ([from]) =>
      () => ({
        arbitrary: from.arbitrary.map(makeJinaRateLimitError),
        terminal: from.terminal?.map(makeJinaRateLimitError),
      }),
  }
);

/**
 * Jina Reader request rejected because the API quota was exhausted.
 *
 * **Example** (Use JinaRateLimitError)
 * ```ts
 * import { Milliseconds } from "@effect-ontology/Error/Base"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { JinaRateLimitError } from "@effect-ontology/Error/Jina"
 *
 * const error = S.decodeUnknownOption(JinaRateLimitError)({
 *   _tag: "JinaRateLimitError", retryAfterMs: Milliseconds.make(1_000) })
 * console.log(O.isSome(error)) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class JinaRateLimitError extends JinaRateLimitErrorBase {
  /**
   * Provider-directed retry delay as an Effect `Duration`.
   *
   * **Example** (Use JinaParseError)
   * ```ts
   * import { Milliseconds } from "@effect-ontology/Error/Base"
   * import { JinaRateLimitError } from "@effect-ontology/Error/Jina"
   *
   * console.log(JinaRateLimitError.make({ retryAfterMs: Milliseconds.make(250) }).retryAfter)
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
 * **Example** (Use JinaParseError)
 * ```ts
 * import { JinaParseError } from "@effect-ontology/Error/Jina"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const error = S.decodeUnknownOption(JinaParseError)({
 *   _tag: "JinaParseError", message: "Reader response is malformed." })
 * console.log(O.isSome(error)) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class JinaParseError extends S.TaggedError<JinaParseError>($I`JinaParseError`)(
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
) {}

/**
 * Jina Reader request that exceeded its configured deadline.
 *
 * **Example** (Use JinaTimeoutError)
 * ```ts
 * import { JinaTimeoutError } from "@effect-ontology/Error/Jina"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const error = S.decodeUnknownOption(JinaTimeoutError)({
 *   _tag: "JinaTimeoutError",
 *   url: "https://example.com/article",
 *   timeoutMs: 5_000
 * })
 * console.log(O.isSome(error)) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class JinaTimeoutError extends S.TaggedError<JinaTimeoutError>($I`JinaTimeoutError`)(
  "JinaTimeoutError",
  {
    url: URLStr.annotateKey({
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
) {}

const JinaErrorDefinition = S.Union([JinaApiError, JinaRateLimitError, JinaParseError, JinaTimeoutError]).pipe(
  S.toTaggedUnion("_tag")
);

/**
 * Exhaustive tagged union of Jina Reader failures.
 *
 * **Example** (Use JinaError)
 * ```ts
 * import { JinaError, JinaApiError } from "@effect-ontology/Error/Jina"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const error = S.decodeUnknownOption(JinaApiError)({
 *   _tag: "JinaApiError", message: "Failed." })
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
 * **Example** (Use JinaError)
 * ```ts
 * import { JinaApiError, type JinaError } from "@effect-ontology/Error/Jina"
 *
 * const error: JinaError = JinaApiError.make({ message: "Failed." })
 * console.log(error._tag)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type JinaError = typeof JinaError.Type;
