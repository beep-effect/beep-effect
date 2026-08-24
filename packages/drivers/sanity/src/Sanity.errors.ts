/**
 * Typed technical errors for the Sanity driver boundary.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $SanityId } from "@beep/identity";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import { O, thunkFalse, thunkUndefined } from "@beep/utils";
import { pipe, Result } from "effect";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as HttpClientError from "effect/unstable/http/HttpClientError";

const $I = $SanityId.create("Sanity.errors");

const SanityHttpStatus = S.Finite.check(
  S.makeFilterGroup(
    [
      S.isInt({
        identifier: $I`SanityHttpStatusInteger`,
        title: "Sanity HTTP status integer",
        description: "Sanity HTTP status values must be integer status codes.",
        message: "Sanity HTTP status values must be integers",
      }),
      S.isGreaterThanOrEqualTo(100, {
        identifier: $I`SanityHttpStatusMinimum`,
        title: "Sanity HTTP status minimum",
        description: "Sanity HTTP status values start at 100.",
        message: "Sanity HTTP status values must be at least 100",
      }),
      S.isLessThanOrEqualTo(599, {
        identifier: $I`SanityHttpStatusMaximum`,
        title: "Sanity HTTP status maximum",
        description: "Sanity HTTP status values end at 599.",
        message: "Sanity HTTP status values must be at most 599",
      }),
    ],
    {
      identifier: $I`SanityHttpStatusChecks`,
      title: "Sanity HTTP status",
      description: "Checks for numeric HTTP status codes retained in Sanity driver errors.",
    }
  )
);

const SanityErrorReasonBase = LiteralKit([
  "config",
  "request encoding",
  "response decoding",
  "response status",
  "transport",
]);

/**
 * Technical error reasons emitted by the Sanity driver.
 *
 * **Example** (Decode known reason values)
 *
 * ```ts
 * import { SanityErrorReason } from "@beep/sanity"
 * import * as O from "effect/Option"
 *
 * console.log(O.isSome(SanityErrorReason.decodeOption("transport"))) // true
 * console.log(O.isSome(SanityErrorReason.decodeOption("unexpected"))) // false
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const SanityErrorReason = SanityErrorReasonBase.pipe(
  $I.annoteSchema("SanityErrorReason", {
    description: "Redacted technical error reasons emitted by the Sanity API driver.",
  }),
  SchemaUtils.withLiteralKitStatics(SanityErrorReasonBase),
  SchemaUtils.withStatics((schema) => ({
    fromUnknown: S.decodeUnknownSync(schema),
    decodeOption: S.decodeUnknownOption(schema),
  }))
);

/**
 * Type for {@link SanityErrorReason}.
 *
 * **Example** (Annotate typed reason value)
 *
 * ```ts
 * import type { SanityErrorReason } from "@beep/sanity"
 *
 * const reason: SanityErrorReason = "response decoding"
 *
 * console.log(reason) // "response decoding"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export type SanityErrorReason = typeof SanityErrorReason.Type;

const SanityErrorFields = {
  cause: S.optionalKey(S.String).annotateKey({
    description: "Redacted cause label captured from an unknown transport or decoding failure.",
  }),
  reason: SanityErrorReason.annotateKey({
    description: "Sanity driver failure reason.",
  }),
  status: S.optionalKey(SanityHttpStatus).annotateKey({
    description: "HTTP status code returned by Sanity when available.",
  }),
  url: S.optionalKey(S.String).annotateKey({
    description: "Sanity request URL associated with the failure when available.",
  }),
} satisfies S.Struct.Fields;
const sameSanityErrorFields = S.toEquivalence(S.TaggedStruct("SanityError", SanityErrorFields));
const sameSanityError = (self: SanityError, that: SanityError): boolean => sameSanityErrorFields(self, that);

/**
 * Technical failure raised by the Sanity driver boundary.
 *
 * **Example** (Create status-based error)
 *
 * ```ts
 * import { SanityError } from "@beep/sanity"
 *
 * const error = SanityError.fromReason("response status", {
 *   status: 404,
 *   url: "https://api.sanity.io/v2025-05-14/data/query/production"
 * })
 *
 * console.log(error.reason) // "response status"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class SanityError extends S.TaggedError<SanityError>($I`SanityError`)(
  "SanityError",
  SanityErrorFields,
  $I.annoteClass<S.declare<SanityError>, readonly [S.TaggedStruct<"SanityError", typeof SanityErrorFields>]>(
    "SanityError",
    {
      description: "Redacted technical failure raised by the Sanity API driver boundary.",
      toEquivalence: () => sameSanityError,
    }
  )
) {
  /**
   * Create a Sanity driver error.
   *
   * **Example** (Create error with cause)
   *
   * ```ts
   * import { SanityError } from "@beep/sanity"
   *
   * const error = SanityError.fromReason("transport", {
   *   cause: new Error("connection reset")
   * })
   *
   * console.log(error.cause) // "Error"
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly fromReason = (reason: SanityErrorReason, options: SanityErrorOptions = {}): SanityError =>
    SanityError.make({
      reason,
      ...O.getSomesStruct({
        cause: causeFromUnknown(options.cause),
        status: O.fromUndefinedOr(options.status),
        url: O.fromUndefinedOr(options.url),
      }),
    });
}

/**
 * Options used when constructing Sanity driver errors.
 *
 * **Example** (Make options with status)
 *
 * ```ts
 * import { SanityErrorOptions } from "@beep/sanity"
 *
 * const options = SanityErrorOptions.make({
 *   status: 500,
 *   url: "https://api.sanity.io/v2025-05-14/data/query/production"
 * })
 *
 * console.log(options.status) // 500
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class SanityErrorOptions extends S.Class<SanityErrorOptions>($I`SanityErrorOptions`)(
  {
    cause: S.optionalKey(S.Defect({ includeStack: true })).annotateKey({
      description: "Original unknown cause used to derive a redacted diagnostic label.",
    }),
    status: S.optionalKey(SanityHttpStatus).annotateKey({
      description: "HTTP status code returned by Sanity when available.",
    }),
    url: S.optionalKey(S.String).annotateKey({
      description: "Sanity request URL associated with the failure when available.",
    }),
  },
  $I.annote("SanityErrorOptions", {
    description: "Options for configuring SanityError instances.",
  })
) {}

// shared driver boundary idiom; no in-family home; future foundation capability candidate.
// fallow-ignore-next-line code-duplication -- safe reflection keeps unknown API causes inside the Sanity boundary
const readProperty = (value: unknown, key: PropertyKey): O.Option<unknown> => {
  if (!P.isObject(value)) {
    return O.none();
  }

  return O.fromUndefinedOr(
    Result.getOrElse(
      Result.try(() => Reflect.get(value, key)),
      thunkUndefined
    )
  );
};

const readString = (value: unknown, key: PropertyKey): O.Option<string> =>
  O.filter(readProperty(value, key), P.isString);

const safeBoolean = (evaluate: () => boolean): boolean => Result.getOrElse(Result.try(evaluate), thunkFalse);

const httpClientCauseLabel = (cause: unknown): O.Option<string> =>
  safeBoolean(() => HttpClientError.isHttpClientError(cause))
    ? pipe(
        readProperty(cause, "reason"),
        O.flatMap((reason) => readString(reason, "_tag")),
        O.map((tag) => `HttpClientError:${tag}`)
      )
    : O.none();

// shared driver boundary idiom; no in-family home; future foundation capability candidate.
// fallow-ignore-next-line code-duplication -- Sanity cause normalization preserves provider-specific HTTP labels
const causeFromUnknown = (cause: unknown): O.Option<string> =>
  P.isUndefined(cause)
    ? O.none()
    : O.firstSomeOf([
        httpClientCauseLabel(cause),
        readString(cause, "_tag"),
        readString(cause, "name"),
        P.isString(cause) ? O.some("String") : O.none(),
      ]);
