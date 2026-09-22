/**
 * EdgeVersion row-converter errors.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $EpistemicTablesId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $EpistemicTablesId.create("entities/EdgeVersion/EdgeVersion.errors");

const EdgeVersionConverterOperation = LiteralKit(["toInsert", "fromRow"]);

/**
 * Schema conversion failed while projecting an EdgeVersion across the
 * persistence boundary.
 *
 * **Example** (Construct converter error)
 *
 * ```ts
 * import { EdgeVersionConverterError } from "@beep/epistemic-tables/entities/EdgeVersion"
 *
 * const error = EdgeVersionConverterError.make({
 *   operation: "toInsert",
 *   reason: "schema conversion failed",
 * })
 * console.log(error.operation)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class EdgeVersionConverterError extends S.TaggedError<EdgeVersionConverterError>($I`EdgeVersionConverterError`)(
  "EdgeVersionConverterError",
  {
    operation: EdgeVersionConverterOperation.annotateKey({
      description: "Converter operation that failed.",
    }),
    reason: S.NonEmptyString.annotateKey({
      description: "Human-readable schema conversion failure.",
    }),
  },
  $I.annoteError<EdgeVersionConverterError>("EdgeVersionConverterError", {
    title: "EdgeVersion converter error",
    description: "Schema conversion failed while projecting an EdgeVersion across the persistence boundary.",
  })
) {
  /**
   * Lift a schema error into a {@link EdgeVersionConverterError}.
   *
   * **Example** (Lift schema error)
   *
   * ```ts
   * import { EdgeVersionConverterError } from "@beep/epistemic-tables/entities/EdgeVersion"
   *
   * const error = EdgeVersionConverterError.make({
   *   operation: "fromRow",
   *   reason: "invalid row",
   * })
   * console.log(error.operation)
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static fromSchema(
    operation: typeof EdgeVersionConverterOperation.Type,
    error: S.SchemaError
  ): EdgeVersionConverterError {
    return EdgeVersionConverterError.make({
      operation,
      reason: error.message.length > 0 ? error.message : "schema conversion failed",
    });
  }
}
