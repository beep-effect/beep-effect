/**
 * Documents SyncOperation row-converter errors.
 *
 * @packageDocumentation
 * @category errors
 * @since 0.0.0
 */

import { $DocumentsTablesId } from "@beep/identity/packages";
import * as S from "effect/Schema";

const $I = $DocumentsTablesId.create("entities/SyncOperation/SyncOperation.errors");

/**
 * Failure converting a SyncOperation persistence row or insert.
 *
 * **Example** (Construct a converter failure)
 *
 * ```ts
 * import { SyncOperationConverterError } from "@beep/documents-tables/entities/SyncOperation"
 *
 * const error = SyncOperationConverterError.make({ message: "invalid SyncOperation row" })
 * console.log(error._tag) // "SyncOperationConverterError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class SyncOperationConverterError extends S.TaggedError<SyncOperationConverterError>(
  $I`SyncOperationConverterError`
)(
  "SyncOperationConverterError",
  {
    message: S.String.annotateKey({
      description: "Rendered schema issue that blocked converting a SyncOperation row or insert.",
    }),
  },
  $I.annoteError<SyncOperationConverterError>("SyncOperationConverterError", {
    title: "SyncOperation converter failure",
    description: "Failure converting a SyncOperation persistence row or insert.",
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
   * import { SyncOperationConverterError } from "@beep/documents-tables/entities/SyncOperation"
   * import { SyncOperation } from "@beep/documents-domain/entities/SyncOperation"
   * import * as Result from "effect/Result"
   * import * as S from "effect/Schema"
   *
   * const converted = Result.mapError(
   *   S.decodeUnknownResult(SyncOperation)({}),
   *   SyncOperationConverterError.fromSchemaError
   * )
   * console.log(Result.isFailure(converted)) // true
   * ```
   *
   * @param error - The schema failure that refused the row or insert.
   * @returns A converter failure carrying the rendered schema failure.
   * @category constructors
   * @since 0.0.0
   */
  static readonly fromSchemaError = (error: S.SchemaError): SyncOperationConverterError =>
    SyncOperationConverterError.make({ message: error.message });
}
