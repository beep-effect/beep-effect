/**
 * Workspace row-converter errors.
 *
 * @packageDocumentation
 * @category errors
 * @since 0.0.0
 */

import { $WorkspaceTablesId } from "@beep/identity/packages";
import * as S from "effect/Schema";

const $I = $WorkspaceTablesId.create("entities/Workspace/Workspace.errors");

/**
 * Failure converting a Workspace persistence row or insert.
 *
 * **Example** (Construct a converter failure)
 *
 * ```ts
 * import { WorkspaceConverterError } from "@beep/workspace-tables/entities/Workspace"
 *
 * const error = WorkspaceConverterError.make({ message: "invalid Workspace row" })
 * console.log(error._tag) // "WorkspaceConverterError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class WorkspaceConverterError extends S.TaggedError<WorkspaceConverterError>($I`WorkspaceConverterError`)(
  "WorkspaceConverterError",
  {
    message: S.String.annotateKey({
      description: "Rendered schema issue that blocked converting a Workspace row or insert.",
    }),
  },
  $I.annoteError<WorkspaceConverterError>("WorkspaceConverterError", {
    title: "Workspace converter failure",
    description: "Failure converting a Workspace persistence row or insert.",
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
   * import { WorkspaceConverterError } from "@beep/workspace-tables/entities/Workspace"
   * import { Workspace } from "@beep/workspace-domain/entities/Workspace"
   * import * as Result from "effect/Result"
   * import * as S from "effect/Schema"
   *
   * const converted = Result.mapError(
   *   S.decodeUnknownResult(Workspace)({}),
   *   WorkspaceConverterError.fromSchemaError
   * )
   * console.log(Result.isFailure(converted)) // true
   * ```
   *
   * @param error - The schema failure that refused the row or insert.
   * @returns A converter failure carrying the rendered schema failure.
   * @category constructors
   * @since 0.0.0
   */
  static readonly fromSchemaError = (error: S.SchemaError): WorkspaceConverterError =>
    WorkspaceConverterError.make({ message: error.message });
}
