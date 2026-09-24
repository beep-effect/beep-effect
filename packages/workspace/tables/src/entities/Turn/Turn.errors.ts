/**
 * Workspace Turn row-converter errors.
 *
 * @packageDocumentation
 * @category errors
 * @since 0.0.0
 */

import { $WorkspaceTablesId } from "@beep/identity/packages";
import * as S from "effect/Schema";

const $I = $WorkspaceTablesId.create("entities/Turn/Turn.errors");

/**
 * Failure converting a Turn persistence row or insert.
 *
 * **Example** (Construct a converter failure)
 *
 * ```ts
 * import { TurnConverterError } from "@beep/workspace-tables/entities/Turn"
 *
 * const error = TurnConverterError.make({ message: "invalid Turn row" })
 * console.log(error._tag) // "TurnConverterError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class TurnConverterError extends S.TaggedError<TurnConverterError>($I`TurnConverterError`)(
  "TurnConverterError",
  {
    message: S.String.annotateKey({
      description: "Rendered schema issue that blocked converting a Turn row or insert.",
    }),
  },
  $I.annoteError<TurnConverterError>("TurnConverterError", {
    title: "Turn converter failure",
    description: "Failure converting a Turn persistence row or insert.",
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
   * import { TurnConverterError } from "@beep/workspace-tables/entities/Turn"
   * import { Turn } from "@beep/workspace-domain/entities/Turn"
   * import * as Result from "effect/Result"
   * import * as S from "effect/Schema"
   *
   * const converted = Result.mapError(
   *   S.decodeUnknownResult(Turn)({}),
   *   TurnConverterError.fromSchemaError
   * )
   * console.log(Result.isFailure(converted)) // true
   * ```
   *
   * @param error - The schema failure that refused the row or insert.
   * @returns A converter failure carrying the rendered schema failure.
   * @category constructors
   * @since 0.0.0
   */
  static readonly fromSchemaError = (error: S.SchemaError): TurnConverterError =>
    TurnConverterError.make({ message: error.message });
}
