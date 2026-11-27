/**
 * Tagged errors for the `beep schema-idioms` command group.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { Err } from "@beep/utils";
import * as Inspectable from "effect/Inspectable";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("commands/SchemaIdioms/SchemaIdioms.errors");

/**
 * **Example** (Read a schema idioms error)
 *
 * ```ts
 * import { SchemaIdiomsError } from "@beep/repo-cli/commands/SchemaIdioms"
 *
 * const error = SchemaIdiomsError.new("could not resolve effect/Schema")
 * console.log(error.message) // "could not resolve effect/Schema"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class SchemaIdiomsError extends S.TaggedError<SchemaIdiomsError, { readonly brand: unique symbol }>(
  $I`SchemaIdiomsError`
)(
  "SchemaIdiomsError",
  {
    message: S.String,
  },
  $I.annoteError<SchemaIdiomsError>("SchemaIdiomsError", {
    description:
      "beep schema-idioms could not resolve the installed effect modules, read their sources, or read or write the generated index files.",
  })
) {
  static readonly new = (message: string): SchemaIdiomsError => SchemaIdiomsError.make({ message });

  static readonly fromCause = (cause: unknown, message: string): SchemaIdiomsError =>
    SchemaIdiomsError.new(`${message}: ${Inspectable.toStringUnknown(cause, 0)}`);

  static readonly mapError = Err.mapCauseError<SchemaIdiomsError, [message: string]>(SchemaIdiomsError.fromCause);
}
