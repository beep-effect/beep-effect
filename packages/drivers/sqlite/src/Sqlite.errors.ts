/**
 * Technical errors raised by the SQLite driver boundary.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $SqliteId } from "@beep/identity";
import { defectDiagnostics, optionalDefectMessage } from "@beep/schema/SchemaUtils/defectDiagnostics";
import { optionalDefect } from "@beep/schema/SchemaUtils/optionalDefect";
import * as S from "effect/Schema";

const $I = $SqliteId.create("Sqlite.errors");

/**
 * Failure of one `@beep/sqlite` driver operation.
 *
 * **Details**
 *
 * `operation` names the step that failed: `connect`, `loadExtension` or
 * `probeFts5`. `cause` keeps the native failure and stays out of the error's
 * equivalence. Adapters translate this error into the error their port
 * declares; it never crosses a port as itself.
 *
 * **Example** (Wrap a failed connection)
 *
 * ```ts
 * import { SqliteError } from "@beep/sqlite"
 *
 * console.log(SqliteError.fromUnknown("connect", new Error("database is locked")).operation)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class SqliteError extends S.TaggedError<SqliteError, { readonly brand: unique symbol }>($I`SqliteError`)(
  "SqliteError",
  {
    operation: S.NonEmptyString.annotateKey({ description: "SQLite driver step that failed." }),
    cause: optionalDefect("Native SQLite or Bun failure, when one was available."),
    message: optionalDefectMessage("Non-empty message of the native failure."),
  },
  $I.annoteError<SqliteError>("SqliteError", {
    description: "Failure of one SQLite driver operation.",
  })
) {
  /**
   * Builds a {@link SqliteError} for `operation` from whatever the native
   * call failed with.
   *
   * **Example** (Wrap an extension load failure)
   *
   * ```ts
   * import { SqliteError } from "@beep/sqlite"
   *
   * console.log(SqliteError.fromUnknown("loadExtension"))
   * ```
   *
   * @category errors
   * @since 0.0.0
   */
  static readonly fromUnknown = (operation: string, cause?: unknown): SqliteError =>
    SqliteError.make({ operation, ...defectDiagnostics(cause) });
}
