/**
 * Documents SyncCursor row-converter errors.
 *
 * @packageDocumentation
 * @category errors
 * @since 0.0.0
 */

import { $DocumentsTablesId } from "@beep/identity/packages";
import * as S from "effect/Schema";

const $I = $DocumentsTablesId.create("entities/SyncCursor/SyncCursor.errors");

/**
 * Failure converting a SyncCursor persistence row or insert.
 *
 * **Example** (Construct a converter failure)
 *
 * ```ts
 * import { SyncCursorConverterError } from "@beep/documents-tables/entities/SyncCursor"
 *
 * const error = SyncCursorConverterError.make({ message: "invalid SyncCursor row" })
 * console.log(error._tag) // "SyncCursorConverterError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class SyncCursorConverterError extends S.TaggedError<SyncCursorConverterError>($I`SyncCursorConverterError`)(
  "SyncCursorConverterError",
  {
    message: S.String.annotateKey({
      description: "Rendered schema issue that blocked converting a SyncCursor row or insert.",
    }),
  },
  $I.annoteError<SyncCursorConverterError>("SyncCursorConverterError", {
    title: "SyncCursor converter failure",
    description: "Failure converting a SyncCursor persistence row or insert.",
  })
) {
  /**
   * Construct a converter failure from the schema failure that refused the row.
   *
   * **Details**
   *
   * The schema failure is rendered rather than carried, so callers never depend
   * on the shape of an issue tree.
   *
   * **Example** (Adapt a schema failure)
   *
   * ```ts
   * import { SyncCursorConverterError } from "@beep/documents-tables/entities/SyncCursor"
   * import { SyncCursor } from "@beep/documents-domain/entities/SyncCursor"
   * import * as Result from "effect/Result"
   * import * as S from "effect/Schema"
   *
   * const converted = Result.mapError(
   *   S.decodeUnknownResult(SyncCursor)({}),
   *   SyncCursorConverterError.fromSchemaError
   * )
   * console.log(Result.isFailure(converted)) // true
   * ```
   *
   * @param error - The schema failure that refused the row or insert.
   * @returns A converter failure carrying the rendered schema failure.
   * @category constructors
   * @since 0.0.0
   */
  static readonly fromSchemaError = (error: S.SchemaError): SyncCursorConverterError =>
    SyncCursorConverterError.make({ message: error.message });
}
