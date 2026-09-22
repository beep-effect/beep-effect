/**
 * Agents ProviderInstance row-converter errors.
 *
 * @packageDocumentation
 * @category errors
 * @since 0.0.0
 */

import { $AgentsTablesId } from "@beep/identity/packages";
import * as S from "effect/Schema";

const $I = $AgentsTablesId.create("entities/ProviderInstance/ProviderInstance.errors");

/**
 * Failure converting a ProviderInstance persistence row or insert.
 *
 * **Example** (Construct a converter failure)
 *
 * ```ts
 * import { ProviderInstanceConverterError } from "@beep/agents-tables/entities/ProviderInstance"
 *
 * const error = ProviderInstanceConverterError.make({ message: "invalid ProviderInstance row" })
 * console.log(error._tag) // "ProviderInstanceConverterError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class ProviderInstanceConverterError extends S.TaggedError<ProviderInstanceConverterError>(
  $I`ProviderInstanceConverterError`
)(
  "ProviderInstanceConverterError",
  {
    message: S.String.annotateKey({
      description: "Rendered schema issue that blocked converting a ProviderInstance row or insert.",
    }),
  },
  $I.annoteError<ProviderInstanceConverterError>("ProviderInstanceConverterError", {
    title: "ProviderInstance converter failure",
    description: "Failure converting a ProviderInstance persistence row or insert.",
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
   * import { ProviderInstanceConverterError } from "@beep/agents-tables/entities/ProviderInstance"
   * import { ProviderInstance } from "@beep/agents-domain/entities/ProviderInstance"
   * import * as Result from "effect/Result"
   * import * as S from "effect/Schema"
   *
   * const converted = Result.mapError(
   *   S.decodeUnknownResult(ProviderInstance)({}),
   *   ProviderInstanceConverterError.fromSchemaError
   * )
   * console.log(Result.isFailure(converted)) // true
   * ```
   *
   * @param error - The schema failure that refused the row or insert.
   * @returns A converter failure carrying the rendered schema failure.
   * @category constructors
   * @since 0.0.0
   */
  static readonly fromSchemaError = (error: S.SchemaError): ProviderInstanceConverterError =>
    ProviderInstanceConverterError.make({ message: error.message });
}
