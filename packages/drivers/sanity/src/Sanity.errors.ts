/**
 * Typed technical errors for the Sanity driver boundary.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $SanityId } from "@beep/identity";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import { O, thunkFalse, thunkUndefined } from "@beep/utils";
import { pipe } from "effect/Function";
import * as HttpClientError from "effect/http/HttpClientError";
import * as P from "effect/Predicate";
import * as Result from "effect/Result";
import * as S from "effect/Schema";

const $I = $SanityId.create("Sanity.errors");

const SanityHttpStatus = S.Finite.check(
  S.makeFilterGroup(
    [
      S.isInt(
        $I.annote("SanityHttpStatusInteger", {
          title: "Sanity HTTP status integer",
          description: "Sanity HTTP status values must be integer status codes.",
          message: "Sanity HTTP status values must be integers",
        })
      ),
      S.isGreaterThanOrEqualTo(
        100,
        $I.annote("SanityHttpStatusMinimum", {
          title: "Sanity HTTP status minimum",
          description: "Sanity HTTP status values start at 100.",
          message: "Sanity HTTP status values must be at least 100",
        })
      ),
      S.isLessThanOrEqualTo(
        599,
        $I.annote("SanityHttpStatusMaximum", {
          title: "Sanity HTTP status maximum",
          description: "Sanity HTTP status values end at 599.",
          message: "Sanity HTTP status values must be at most 599",
        })
      ),
    ],
    $I.annote("SanityHttpStatusChecks", {
      title: "Sanity HTTP status",
      description: "Checks for numeric HTTP status codes retained in Sanity driver errors.",
    })
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
 * **Example** (Decode known reason values)
 *
 * ```ts
 * import { SanityErrorReason } from "@beep/sanity"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * console.log(O.isSome(S.decodeUnknownOption(SanityErrorReason)("transport"))) // true
 * console.log(O.isSome(S.decodeUnknownOption(SanityErrorReason)("unexpected"))) // false
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const SanityErrorReason = SanityErrorReasonBase.pipe(
  $I.annoteSchema("SanityErrorReason", {
    description: "Redacted technical error reasons emitted by the Sanity API driver.",
  }),
  SchemaUtils.withLiteralKitStatics(SanityErrorReasonBase)
);

/**
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

/**
 * **Example** (Create status-based error)
 *
 * ```ts
 * import { SanityError, SanityErrorOptions } from "@beep/sanity"
 *
 * const error = SanityError.fromReason(
 *   "response status",
 *   SanityErrorOptions.make({
 *     status: 404,
 *     url: "https://api.sanity.io/v2025-05-14/data/query/production"
 *   })
 * )
 *
 * console.log(error.reason) // "response status"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class SanityError extends S.TaggedError<SanityError, { readonly brand: unique symbol }>($I`SanityError`)(
  "SanityError",
  {
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
  },
  $I.annoteError<SanityError>("SanityError", {
    description: "Redacted technical failure raised by the Sanity API driver boundary.",
  })
) {
  /**
   * Create a Sanity driver error.
   *
   * **Example** (Create error with cause)
   *
   * ```ts
   * import { SanityError, SanityErrorOptions } from "@beep/sanity"
   *
   * const error = SanityError.fromReason(
   *   "transport",
   *   SanityErrorOptions.make({ cause: new Error("connection reset") })
   * )
   *
   * console.log(error.cause) // "Error"
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly fromReason = (
    reason: SanityErrorReason,
    options: SanityErrorOptions = SanityErrorOptions.make({})
  ): SanityError =>
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
export class SanityErrorOptions extends S.Opaque<SanityErrorOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    cause: S.optionalKey(
      S.Defect({ includeStack: true }).pipe(S.overrideToEquivalence(SchemaUtils.alwaysEquivalent))
    ).annotateKey({
      description: "Original unknown cause used to derive a redacted diagnostic label.",
    }),
    status: S.optionalKey(SanityHttpStatus).annotateKey({
      description: "HTTP status code returned by Sanity when available.",
    }),
    url: S.optionalKey(S.String).annotateKey({
      description: "Sanity request URL associated with the failure when available.",
    }),
  }).pipe(
    $I.annoteSchema("SanityErrorOptions", {
      description: "Options for configuring SanityError instances.",
    })
  )
) {}

// fallow-ignore-next-line code-duplication -- error-boundary cause-reflection idiom repeated across sibling drivers that must not depend on each other; no foundation capability owns it yet. Owner: @beep/sanity. Exit: import it and delete this copy once a foundation capability package exports the idiom.
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

// fallow-ignore-next-line code-duplication -- Sanity cause normalization keeps provider-specific HTTP labels, mirroring sibling drivers. Owner: @beep/sanity. Exit: import a shared cause normalizer once a foundation capability package exports one.
const causeFromUnknown = (cause: unknown): O.Option<string> =>
  P.isUndefined(cause)
    ? O.none()
    : O.firstSomeOf([
        httpClientCauseLabel(cause),
        readString(cause, "_tag"),
        readString(cause, "name"),
        P.isString(cause) ? O.some("String") : O.none(),
      ]);
