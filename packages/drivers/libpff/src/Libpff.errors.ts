/**
 * Typed technical errors for the libpff driver boundary.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LibpffId } from "@beep/identity";
import { LiteralKit, NonNegativeInt, SchemaUtils, TaggedErrorClass } from "@beep/schema";
import { O, Str } from "@beep/utils";
import { dual } from "effect/Function";
import * as S from "effect/Schema";

const $I = $LibpffId.create("Libpff.errors");
const LibpffErrorReasonBase = LiteralKit(["config", "engine-unavailable", "output-limit", "process", "timeout"]);

/**
 * Technical libpff failure reasons.
 *
 * **Example** (Log available error reasons)
 *
 * ```ts
 * import { LibpffErrorReason } from "@beep/libpff"
 *
 * console.log(LibpffErrorReason)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const LibpffErrorReason = LibpffErrorReasonBase.pipe(
  $I.annoteSchema("LibpffErrorReason", {
    description: "Redacted technical error reasons emitted by the libpff driver.",
  }),
  SchemaUtils.withLiteralKitStatics(LibpffErrorReasonBase)
);

/**
 * Type for {@link LibpffErrorReason}.
 *
 * **Example** (Assign a typed reason)
 *
 * ```ts
 * import type { LibpffErrorReason } from "@beep/libpff"
 *
 * const reason: LibpffErrorReason = "engine-unavailable"
 * console.log(reason)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export type LibpffErrorReason = typeof LibpffErrorReason.Type;

/**
 * Options used when constructing {@link LibpffError} instances.
 *
 * **Example** (Make options with exitCode)
 *
 * ```ts
 * import { LibpffErrorOptions } from "@beep/libpff"
 * import { NonNegativeInt } from "@beep/schema"
 *
 * const options = LibpffErrorOptions.make({ exitCode: NonNegativeInt.make(2) })
 * console.log(options.exitCode)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class LibpffErrorOptions extends S.Class<LibpffErrorOptions>($I`LibpffErrorOptions`)(
  {
    cause: S.optionalKey(S.String).annotateKey({
      description: "Sanitized technical cause string when one is safe to retain.",
    }),
    exitCode: S.optionalKey(NonNegativeInt).annotateKey({
      description: "Process exit status associated with the libpff failure when one was available.",
    }),
  },
  $I.annote("LibpffErrorOptions", {
    description: "Options for configuring LibpffError instances.",
  })
) {}

/**
 * Technical failure raised inside the libpff driver boundary.
 *
 * **Example** (Create error from reason)
 *
 * ```ts
 * import { LibpffError } from "@beep/libpff"
 *
 * const error = LibpffError.fromReason("engine-unavailable")
 * console.log(error.reason)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class LibpffError extends TaggedErrorClass<LibpffError>($I`LibpffError`)(
  "LibpffError",
  {
    cause: S.OptionFromOptionalKey(S.String).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Sanitized technical cause string when one is safe to retain.",
      })
    ),
    exitCode: S.OptionFromOptionalKey(NonNegativeInt).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Process exit status associated with the libpff failure when one was available.",
      })
    ),
    reason: LibpffErrorReason.annotateKey({
      description: "Redacted technical error reason.",
    }),
  },
  $I.annote("LibpffError", {
    description: "Redacted technical failure raised inside the libpff driver boundary.",
  })
) {
  /**
   * Create a libpff technical error with sanitized context.
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly fromReason = (
    reason: LibpffErrorReason,
    options: LibpffErrorOptions = LibpffErrorOptions.make({})
  ): LibpffError =>
    LibpffError.make({
      cause: O.fromUndefinedOr(options.cause),
      exitCode: O.fromUndefinedOr(options.exitCode),
      reason,
    });
}

/**
 * Create a libpff technical error with a typed reason.
 *
 * **Example** (Create typed technical error)
 *
 * ```ts
 * import { pipe } from "effect"
 * import { LibpffErrorOptions, makeLibpffError } from "@beep/libpff"
 *
 * const error = makeLibpffError("engine-unavailable")
 * const piped = pipe("timeout", makeLibpffError(LibpffErrorOptions.make({ cause: "pffexport stalled" })))
 * console.log(error.reason, piped.reason)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeLibpffError: {
  (options?: LibpffErrorOptions): (reason: LibpffErrorReason) => LibpffError;
  (reason: LibpffErrorReason, options?: LibpffErrorOptions): LibpffError;
} = dual((args) => Str.isString(args[0]), LibpffError.fromReason);
