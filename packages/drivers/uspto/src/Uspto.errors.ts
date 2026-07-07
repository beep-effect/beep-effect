/**
 * Typed technical errors for the USPTO driver boundary.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $UsptoId } from "@beep/identity";
import { LiteralKit, NonNegativeInt, SchemaUtils, TaggedErrorClass } from "@beep/schema";
import * as O from "@beep/utils/Option";
import * as S from "effect/Schema";

const $I = $UsptoId.create("Uspto.errors");
const UsptoErrorReasonKit = LiteralKit([
  "config",
  "not-found",
  "rate-limited",
  "response-decoding",
  "response-status",
  "transport",
]);

/**
 * Technical USPTO driver failure reasons.
 *
 * @example
 * ```ts
 * import { UsptoErrorReason } from "@beep/uspto"
 *
 * console.log(UsptoErrorReason)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const UsptoErrorReason = UsptoErrorReasonKit.pipe(
  $I.annoteSchema("UsptoErrorReason", {
    description: "Redacted technical error reasons emitted by the USPTO driver.",
  }),
  SchemaUtils.withLiteralKitStatics(UsptoErrorReasonKit),
  SchemaUtils.withStatics((schema: typeof UsptoErrorReasonKit) => ({
    decodeOption: S.decodeUnknownOption(schema),
    fromUnknown: S.decodeUnknownSync(schema),
  }))
);

/**
 * Type for {@link UsptoErrorReason}.
 *
 * @example
 * ```ts
 * import type { UsptoErrorReason } from "@beep/uspto"
 *
 * const reason: UsptoErrorReason = "transport"
 * console.log(reason)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export type UsptoErrorReason = typeof UsptoErrorReason.Type;

class UsptoErrorOptions extends S.Class<UsptoErrorOptions>($I`UsptoErrorOptions`)(
  {
    cause: S.OptionFromOptionalKey(S.String).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Sanitized technical cause when one is available.",
      })
    ),
    status: S.OptionFromOptionalKey(NonNegativeInt).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "HTTP response status associated with the failure when one is available.",
      })
    ),
  },
  $I.annote("UsptoErrorOptions", {
    description: "Options for configuring sanitized USPTO driver errors.",
  })
) {}

/**
 * Technical failure raised inside the USPTO driver boundary.
 *
 * @example
 * ```ts
 * import { UsptoError } from "@beep/uspto"
 *
 * const error = UsptoError.fromReason("transport")
 * console.log(error.reason)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class UsptoError extends TaggedErrorClass<UsptoError>($I`UsptoError`)(
  "UsptoError",
  {
    cause: S.OptionFromOptionalKey(S.String).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Sanitized technical cause when one is available.",
      })
    ),
    reason: UsptoErrorReason.annotateKey({
      description: "Redacted technical error reason.",
    }),
    status: S.OptionFromOptionalKey(NonNegativeInt).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "HTTP response status associated with the failure when one is available.",
      })
    ),
  },
  $I.annote("UsptoError", {
    description: "Redacted technical failure raised inside the USPTO driver boundary.",
  })
) {
  /**
   * Create a USPTO technical error with sanitized context.
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly fromReason = (
    reason: UsptoErrorReason,
    options: { readonly cause?: string; readonly status?: NonNegativeInt } = {}
  ): UsptoError => {
    const context = UsptoErrorOptions.make({
      cause: O.fromUndefinedOr(options.cause),
      status: O.fromUndefinedOr(options.status),
    });
    return UsptoError.make({
      cause: context.cause,
      reason,
      status: context.status,
    });
  };
}

/**
 * Create a USPTO technical error with a typed reason.
 *
 * @example
 * ```ts
 * import { makeUsptoError } from "@beep/uspto"
 *
 * const error = makeUsptoError("response-decoding")
 * console.log(error.reason)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeUsptoError: (
  reason: UsptoErrorReason,
  options?: { readonly cause?: string; readonly status?: NonNegativeInt }
) => UsptoError = UsptoError.fromReason;
