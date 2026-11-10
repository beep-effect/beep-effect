/**
 * Technical errors raised by the PGlite driver boundary.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $PgliteId } from "@beep/identity";
import { defectDiagnostics, optionalDefectMessage } from "@beep/schema/SchemaUtils/defectDiagnostics";
import { optionalDefect } from "@beep/schema/SchemaUtils/optionalDefect";
import * as S from "effect/Schema";

const $I = $PgliteId.create("Pglite.errors");

/**
 * Technical failure raised by the `@beep/pglite` driver boundary.
 *
 * **Details**
 *
 * `operation` identifies the driver operation that failed (for example
 * `"connect"`). The originating defect is preserved in `cause`. These are
 * driver-internal failures: server adapters translate them into port-declared
 * errors and they never escape as themselves.
 *
 * **Example** (Create error from unknown)
 *
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
export class PgliteError extends S.TaggedError<PgliteError, { readonly brand: unique symbol }>($I`PgliteError`)(
  "PgliteError",
  {
    operation: S.NonEmptyString.annotateKey({
      description: "Driver operation that failed.",
    }),
    cause: optionalDefect("Original native or third-party defect when one was available."),
    message: optionalDefectMessage("Non-empty message extracted from the originating failure."),
  },
  $I.annoteError<PgliteError>("PgliteError", {
    description: "Technical PGlite driver failure scoped to a driver operation.",
  })
) {
  /**
   * Normalize an unknown PGlite-adjacent failure into a {@link PgliteError}.
   *
   * **Example** (Normalize unknown failure)
   *
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
    PgliteError.make({ operation, ...defectDiagnostics(cause) });
}
