/**
 * ClaimDisposition row-converter errors.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $EpistemicTablesId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $EpistemicTablesId.create("entities/ClaimDisposition/ClaimDisposition.errors");

const ClaimDispositionConverterOperation = LiteralKit(["toInsert", "fromRow"]);

/**
 * Schema conversion failed while projecting a ClaimDisposition across the
 * persistence boundary.
 *
 * **Example** (Construct converter error)
 *
 * ```ts
 * import { ClaimDispositionConverterError } from "@beep/epistemic-tables/entities/ClaimDisposition"
 *
 * const error = ClaimDispositionConverterError.make({
 *   operation: "toInsert",
 *   reason: "schema conversion failed",
 * })
 * console.log(error.operation)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class ClaimDispositionConverterError extends S.TaggedError<ClaimDispositionConverterError>(
  $I`ClaimDispositionConverterError`
)(
  "ClaimDispositionConverterError",
  {
    operation: ClaimDispositionConverterOperation.annotateKey({
      description: "Converter operation that failed.",
    }),
    reason: S.NonEmptyString.annotateKey({
      description: "Human-readable schema conversion failure.",
    }),
  },
  $I.annoteError<ClaimDispositionConverterError>("ClaimDispositionConverterError", {
    title: "ClaimDisposition converter error",
    description: "Schema conversion failed while projecting a ClaimDisposition across the persistence boundary.",
  })
) {
  /**
   * Lift a schema error into a {@link ClaimDispositionConverterError}.
   *
   * **Example** (Lift schema error)
   *
   * ```ts
   * import { ClaimDispositionConverterError } from "@beep/epistemic-tables/entities/ClaimDisposition"
   *
   * const error = ClaimDispositionConverterError.make({
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
    operation: typeof ClaimDispositionConverterOperation.Type,
    error: S.SchemaError
  ): ClaimDispositionConverterError {
    return ClaimDispositionConverterError.make({
      operation,
      reason: error.message.length > 0 ? error.message : "schema conversion failed",
    });
  }
}
