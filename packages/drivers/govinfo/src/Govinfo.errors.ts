/**
 * Typed technical errors for the GovInfo driver boundary.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $GovinfoId } from "@beep/identity";
import { LiteralKit, SchemaUtils, TaggedErrorClass } from "@beep/schema";
import { O } from "@beep/utils";
import * as S from "effect/Schema";

const $I = $GovinfoId.create("Govinfo.errors");

/**
 * Technical error reasons emitted by the GovInfo REST API driver.
 *
 * @example
 * ```ts
 * import { GovinfoErrorReason } from "@beep/govinfo"
 *
 * console.log(GovinfoErrorReason.ast)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const GovinfoErrorReason = LiteralKit([
  "config",
  "request encoding",
  "response decoding",
  "response status",
  "transport",
]).pipe(
  $I.annoteSchema("GovinfoErrorReason", {
    description: "Redacted technical error reasons emitted by the GovInfo REST API driver.",
  })
);

/**
 * Type for {@link GovinfoErrorReason}.
 *
 * @example
 * ```ts
 * import type { GovinfoErrorReason } from "@beep/govinfo"
 *
 * const reason: GovinfoErrorReason = "transport"
 * console.log(reason)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export type GovinfoErrorReason = typeof GovinfoErrorReason.Type;

/**
 * Numeric HTTP status code carried by GovInfo technical errors.
 *
 * @example
 * ```ts
 * import { GovinfoHttpStatus } from "@beep/govinfo"
 * import * as S from "effect/Schema"
 *
 * const status = S.decodeUnknownSync(GovinfoHttpStatus)(429)
 * console.log(status)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const GovinfoHttpStatus = S.Int.check(S.isGreaterThanOrEqualTo(100), S.isLessThanOrEqualTo(599)).pipe(
  $I.annoteSchema("GovinfoHttpStatus", {
    description: "Numeric HTTP status code carried by GovInfo technical errors.",
  })
);

/**
 * Type for {@link GovinfoHttpStatus}.
 *
 * @example
 * ```ts
 * import { GovinfoHttpStatus } from "@beep/govinfo"
 * import type { GovinfoHttpStatus as GovinfoHttpStatusValue } from "@beep/govinfo"
 * import * as S from "effect/Schema"
 *
 * const status: GovinfoHttpStatusValue = S.decodeUnknownSync(GovinfoHttpStatus)(503)
 * console.log(status)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type GovinfoHttpStatus = typeof GovinfoHttpStatus.Type;

/**
 * Options used when constructing {@link GovinfoError} instances.
 *
 * @example
 * ```ts
 * import { GovinfoErrorOptions } from "@beep/govinfo"
 * import * as O from "effect/Option"
 *
 * const options = GovinfoErrorOptions.make({ status: O.some(429) })
 * console.log(options.status)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GovinfoErrorOptions extends S.Class<GovinfoErrorOptions>($I`GovinfoErrorOptions`)(
  {
    cause: S.OptionFromOptionalKey(S.Defect({ includeStack: true })).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Original native or third-party defect when one was available.",
      })
    ),
    status: S.OptionFromOptionalKey(GovinfoHttpStatus).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "HTTP response status associated with the GovInfo failure when one was available.",
      })
    ),
  },
  $I.annote("GovinfoErrorOptions", {
    description: "Options for configuring GovinfoError instances.",
  })
) {}

/**
 * Technical failure raised by the GovInfo REST API driver boundary.
 *
 * @example
 * ```ts
 * import { GovinfoError } from "@beep/govinfo"
 *
 * const error = GovinfoError.of("config")
 * console.log(error.reason)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class GovinfoError extends TaggedErrorClass<GovinfoError>($I`GovinfoError`)(
  "GovinfoError",
  {
    cause: S.OptionFromOptionalKey(S.Defect({ includeStack: true })).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Original native or third-party defect when one was available.",
      })
    ),
    reason: GovinfoErrorReason,
    status: S.OptionFromOptionalKey(GovinfoHttpStatus).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "HTTP response status associated with the GovInfo failure when one was available.",
      })
    ),
  },
  $I.annote("GovinfoError", {
    description: "Redacted technical failure raised by the GovInfo REST API driver boundary.",
  })
) {
  /**
   * Create a GovInfo driver error for a reason, optionally carrying a cause and status.
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly of = (
    reason: GovinfoErrorReason,
    options: GovinfoErrorOptions = GovinfoErrorOptions.make({})
  ): GovinfoError =>
    GovinfoError.make({
      cause: options.cause,
      reason,
      status: options.status,
    });

  /**
   * Create a GovInfo configuration error (for example, a missing API key).
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly config = (cause?: unknown): GovinfoError =>
    GovinfoError.make({
      cause: O.fromUndefinedOr(cause),
      reason: "config",
    });
}
