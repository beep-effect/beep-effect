/**
 * Documents SyncConflict row-converter errors.
 *
 * @packageDocumentation
 * @category errors
 * @since 0.0.0
 */

import { $DocumentsTablesId } from "@beep/identity/packages";
import * as S from "effect/Schema";

const $I = $DocumentsTablesId.create("entities/SyncConflict/SyncConflict.errors");

/**
 * Failure converting a SyncConflict persistence row or insert.
 *
 * **Example** (Construct a converter failure)
 *
 * ```ts
 * import { SyncConflictConverterError } from "@beep/documents-tables/entities/SyncConflict"
 *
 * const error = SyncConflictConverterError.make({ message: "invalid SyncConflict row" })
 * console.log(error._tag) // "SyncConflictConverterError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class SyncConflictConverterError extends S.TaggedError<SyncConflictConverterError>(
  $I`SyncConflictConverterError`
)(
  "SyncConflictConverterError",
  {
    message: S.String.annotateKey({
      description: "Rendered schema issue that blocked converting a SyncConflict row or insert.",
    }),
  },
  $I.annoteError<SyncConflictConverterError>("SyncConflictConverterError", {
    title: "SyncConflict converter failure",
    description: "Failure converting a SyncConflict persistence row or insert.",
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
   * import { SyncConflictConverterError } from "@beep/documents-tables/entities/SyncConflict"
   * import { SyncConflict } from "@beep/documents-domain/entities/SyncConflict"
   * import * as Result from "effect/Result"
   * import * as S from "effect/Schema"
   *
   * const converted = Result.mapError(
   *   S.decodeUnknownResult(SyncConflict)({}),
   *   SyncConflictConverterError.fromSchemaError
   * )
   * console.log(Result.isFailure(converted)) // true
   * ```
   *
   * @param error - The schema failure that refused the row or insert.
   * @returns A converter failure carrying the rendered schema failure.
   * @category constructors
   * @since 0.0.0
   */
  static readonly fromSchemaError = (error: S.SchemaError): SyncConflictConverterError =>
    SyncConflictConverterError.make({ message: error.message });
}
