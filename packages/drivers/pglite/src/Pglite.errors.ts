/**
 * Technical errors raised by the PGlite driver boundary.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $PgliteId } from "@beep/identity";
import { SchemaUtils, TaggedErrorClass } from "@beep/schema";
import { O } from "@beep/utils";
import * as S from "effect/Schema";

const $I = $PgliteId.create("Pglite.errors");

const decodeDefectOption = S.decodeUnknownOption(S.Defect({ includeStack: true }));
const decodeMessageOption = S.decodeUnknownOption(S.NonEmptyString);

const getErrorMessage = (value: unknown): O.Option<string> =>
  value instanceof Error ? decodeMessageOption(value.message) : O.none();

/**
 * Technical failure raised by the `@beep/pglite` driver boundary.
 *
 * `operation` identifies the driver operation that failed (for example
 * `"connect"`). The originating defect is preserved in `cause`. These are
 * driver-internal failures: server adapters translate them into port-declared
 * errors and they never escape as themselves.
 *
 * @example
 * ```ts
 * import { PgliteError } from "@beep/pglite"
 *
 * const error = PgliteError.fromUnknown("connect", new Error("boom"))
 * console.log(error.operation)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class PgliteError extends TaggedErrorClass<PgliteError>($I`PgliteError`)(
  "PgliteError",
  {
    operation: S.NonEmptyString.annotateKey({
      description: "Driver operation that failed.",
    }),
    cause: S.OptionFromOptionalKey(S.Defect({ includeStack: true })).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Original native or third-party defect when one was available.",
      })
    ),
    message: S.OptionFromOptionalKey(S.NonEmptyString).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Non-empty message extracted from the originating failure.",
      })
    ),
  },
  $I.annote("PgliteError", {
    description: "Technical PGlite driver failure scoped to a driver operation.",
  })
) {
  /**
   * Normalize an unknown PGlite-adjacent failure into a {@link PgliteError}.
   *
   * @example
   * ```ts
   * import { PgliteError } from "@beep/pglite"
   *
   * const error = PgliteError.fromUnknown("connect", new Error("failed"))
   * console.log(error)
   * ```
   *
   * @category errors
   * @since 0.0.0
   */
  static readonly fromUnknown = (operation: string, cause?: unknown): PgliteError =>
    PgliteError.make({
      operation,
      cause: decodeDefectOption(cause),
      message: getErrorMessage(cause),
    });
}
