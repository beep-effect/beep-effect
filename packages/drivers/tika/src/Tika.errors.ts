/**
 * Typed technical errors for the Tika driver boundary.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $TikaId } from "@beep/identity";
import { LiteralKit, NonNegativeInt, SchemaUtils, TaggedErrorClass } from "@beep/schema";
import { O, Str } from "@beep/utils";
import { dual } from "effect/Function";
import * as S from "effect/Schema";

const $I = $TikaId.create("Tika.errors");
const TikaErrorReasonBase = LiteralKit([
  "config",
  "engine-unavailable",
  "output-budget",
  "response-decoding",
  "response-status",
  "timeout",
  "transport",
]);

/**
 * Technical Tika failure reasons.
 *
 * **Example** (Log TikaErrorReason object)
 *
 * ```ts
 * import { TikaErrorReason } from "@beep/tika"
 *
 * console.log(TikaErrorReason)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const TikaErrorReason = TikaErrorReasonBase.pipe(
  $I.annoteSchema("TikaErrorReason", {
    description: "Redacted technical error reasons emitted by the Tika driver.",
  }),
  SchemaUtils.withLiteralKitStatics(TikaErrorReasonBase)
);

/**
 * Type for {@link TikaErrorReason}.
 *
 * **Example** (Assign typed error reason)
 *
 * ```ts
 * import type { TikaErrorReason } from "@beep/tika"
 *
 * const reason: TikaErrorReason = "engine-unavailable"
 * console.log(reason)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export type TikaErrorReason = typeof TikaErrorReason.Type;

/**
 * Options used when constructing {@link TikaError} instances.
 *
 * **Example** (Make options with status)
 *
 * ```ts
 * import { TikaErrorOptions } from "@beep/tika"
 * import { NonNegativeInt } from "@beep/schema"
 *
 * const options = TikaErrorOptions.make({ statusCode: NonNegativeInt.make(503) })
 * console.log(options.statusCode)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class TikaErrorOptions extends S.Class<TikaErrorOptions>($I`TikaErrorOptions`)(
  {
    cause: S.optionalKey(S.String).annotateKey({
      description: "Sanitized technical cause string when one is safe to retain.",
    }),
    statusCode: S.optionalKey(NonNegativeInt).annotateKey({
      description: "HTTP or process status code associated with the Tika failure when one was available.",
    }),
  },
  $I.annote("TikaErrorOptions", {
    description: "Options for configuring TikaError instances.",
  })
) {}

/**
 * Technical failure raised inside the Tika driver boundary.
 *
 * **Example** (Create error from reason)
 *
 * ```ts
 * import { TikaError } from "@beep/tika"
 *
 * const error = TikaError.fromReason("engine-unavailable")
 * console.log(error.reason)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class TikaError extends TaggedErrorClass<TikaError>($I`TikaError`)(
  "TikaError",
  {
    cause: S.OptionFromOptionalKey(S.String).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Sanitized technical cause string when one is safe to retain.",
      })
    ),
    reason: TikaErrorReason.annotateKey({
      description: "Redacted technical error reason.",
    }),
    statusCode: S.OptionFromOptionalKey(NonNegativeInt).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "HTTP or process status code associated with the Tika failure when one was available.",
      })
    ),
  },
  $I.annote("TikaError", {
    description: "Redacted technical failure raised inside the Tika driver boundary.",
  })
) {
  /**
   * Create a Tika technical error with sanitized context.
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly fromReason = (
    reason: TikaErrorReason,
    options: TikaErrorOptions = TikaErrorOptions.make({})
  ): TikaError =>
    TikaError.make({
      cause: O.fromUndefinedOr(options.cause),
      reason,
      statusCode: O.fromUndefinedOr(options.statusCode),
    });
}

/**
 * Create a Tika technical error with a typed reason.
 *
 * **Example** (Make error with reason)
 *
 * ```ts
 * import { makeTikaError } from "@beep/tika"
 *
 * const error = makeTikaError("engine-unavailable")
 * console.log(error.reason)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeTikaError: {
  (options?: TikaErrorOptions): (reason: TikaErrorReason) => TikaError;
  (reason: TikaErrorReason, options?: TikaErrorOptions): TikaError;
} = dual((args) => Str.isString(args[0]), TikaError.fromReason);
