/**
 * Workspace Thread row-converter errors.
 *
 * @packageDocumentation
 * @category errors
 * @since 0.0.0
 */

import { $WorkspaceTablesId } from "@beep/identity/packages";
import * as S from "effect/Schema";

const $I = $WorkspaceTablesId.create("entities/Thread/Thread.errors");

/**
 * Failure converting a Thread persistence row or insert.
 *
 * **Example** (Construct a converter failure)
 *
 * ```ts
 * import { ThreadConverterError } from "@beep/workspace-tables/entities/Thread"
 *
 * const error = ThreadConverterError.make({ message: "invalid Thread row" })
 * console.log(error._tag) // "ThreadConverterError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class ThreadConverterError extends S.TaggedError<ThreadConverterError>($I`ThreadConverterError`)(
  "ThreadConverterError",
  {
    message: S.String.annotateKey({
      description: "Rendered schema issue that blocked converting a Thread row or insert.",
    }),
  },
  $I.annoteError<ThreadConverterError>("ThreadConverterError", {
    title: "Thread converter failure",
    description: "Failure converting a Thread persistence row or insert.",
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
   * import { ThreadConverterError } from "@beep/workspace-tables/entities/Thread"
   * import { Thread } from "@beep/workspace-domain/entities/Thread"
   * import * as Result from "effect/Result"
   * import * as S from "effect/Schema"
   *
   * const converted = Result.mapError(
   *   S.decodeUnknownResult(Thread)({}),
   *   ThreadConverterError.fromSchemaError
   * )
   * console.log(Result.isFailure(converted)) // true
   * ```
   *
   * @param error - The schema failure that refused the row or insert.
   * @returns A converter failure carrying the rendered schema failure.
   * @category constructors
   * @since 0.0.0
   */
  static readonly fromSchemaError = (error: S.SchemaError): ThreadConverterError =>
    ThreadConverterError.make({ message: error.message });
}
