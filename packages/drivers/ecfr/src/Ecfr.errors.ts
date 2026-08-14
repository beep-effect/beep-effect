/**
 * Typed technical errors for the eCFR driver boundary.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $EcfrId } from "@beep/identity";
import { LiteralKit, NonNegativeInt, SchemaUtils } from "@beep/schema";
import { O } from "@beep/utils";
import * as S from "effect/Schema";

const $I = $EcfrId.create("Ecfr.errors");
const EcfrErrorReasonBase = LiteralKit([
  "config",
  "request encoding",
  "response decoding",
  "response status",
  "transport",
]);

/**
 * Technical error reasons emitted by the eCFR REST API driver.
 *
 * **Example** (Log AST error reason)
 *
 * ```ts
 * import { EcfrErrorReason } from "@beep/ecfr"
 *
 * console.log(EcfrErrorReason.ast)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const EcfrErrorReason = EcfrErrorReasonBase.pipe(
  $I.annoteSchema("EcfrErrorReason", {
    description: "Redacted technical error reasons emitted by the eCFR REST API driver.",
  }),
  SchemaUtils.withLiteralKitStatics(EcfrErrorReasonBase),
  SchemaUtils.withStatics((schema: typeof EcfrErrorReasonBase) => ({
    decodeOption: S.decodeUnknownOption(schema),
    fromUnknown: S.decodeUnknownSync(schema),
  }))
);

/**
 * Type for {@link EcfrErrorReason}.
 *
 * **Example** (Assign transport reason type)
 *
 * ```ts
 * import type { EcfrErrorReason } from "@beep/ecfr"
 *
 * const reason: EcfrErrorReason = "transport"
 * console.log(reason)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export type EcfrErrorReason = typeof EcfrErrorReason.Type;

/**
 * Options used when constructing {@link EcfrError} instances.
 *
 * **Example** (Make options with status)
 *
 * ```ts
 * import { EcfrErrorOptions } from "@beep/ecfr"
 * import { NonNegativeInt } from "@beep/schema"
 * import * as O from "effect/Option"
 *
 * const options = EcfrErrorOptions.make({ status: O.some(NonNegativeInt.make(503)) })
 * console.log(options.status)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EcfrErrorOptions extends S.Class<EcfrErrorOptions>($I`EcfrErrorOptions`)(
  {
    cause: S.OptionFromOptionalKey(S.Defect({ includeStack: true })).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Original native or third-party defect when one was available.",
      })
    ),
    status: S.OptionFromOptionalKey(NonNegativeInt).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "HTTP response status code associated with the eCFR failure when one was available.",
      })
    ),
  },
  $I.annote("EcfrErrorOptions", {
    description: "Options for configuring EcfrError instances.",
  })
) {}

const EcfrErrorFields = {
  cause: S.OptionFromOptionalKey(S.Defect({ includeStack: true })).pipe(
    SchemaUtils.withNoneDefault,
    S.annotateKey({
      description: "Original native or third-party defect when one was available.",
    })
  ),
  reason: EcfrErrorReason.annotateKey({
    description: "Redacted technical error reason.",
  }),
  status: S.OptionFromOptionalKey(NonNegativeInt).pipe(
    SchemaUtils.withNoneDefault,
    S.annotateKey({
      description: "HTTP response status code associated with the eCFR failure when one was available.",
    })
  ),
} satisfies S.Struct.Fields;
const sameEcfrErrorFields = S.toEquivalence(S.TaggedStruct("EcfrError", EcfrErrorFields));
const sameEcfrError = (self: EcfrError, that: EcfrError): boolean => sameEcfrErrorFields(self, that);

/**
 * Technical failure raised by the eCFR REST API driver boundary.
 *
 * **Example** (Create transport EcfrError)
 *
 * ```ts
 * import { EcfrError } from "@beep/ecfr"
 *
 * const error = EcfrError.of("transport")
 * console.log(error.reason)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class EcfrError extends S.TaggedError<EcfrError>($I`EcfrError`)(
  "EcfrError",
  EcfrErrorFields,
  $I.annoteClass<S.declare<EcfrError>, readonly [S.TaggedStruct<"EcfrError", typeof EcfrErrorFields>]>("EcfrError", {
    description: "Redacted technical failure raised by the eCFR REST API driver boundary.",
    toEquivalence: () => sameEcfrError,
  })
) {
  /**
   * Create an eCFR driver error for a reason, optionally carrying a cause and status.
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly of = (reason: EcfrErrorReason, options: EcfrErrorOptions = EcfrErrorOptions.make({})): EcfrError =>
    EcfrError.make({
      cause: options.cause,
      reason,
      status: options.status,
    });

  /**
   * Create an eCFR configuration error.
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly config = (cause?: unknown): EcfrError =>
    EcfrError.make({
      cause: O.fromUndefinedOr(cause),
      reason: "config",
    });
}
