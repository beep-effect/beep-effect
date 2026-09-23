/**
 * CandidateClaim row-converter errors.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $EpistemicTablesId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $EpistemicTablesId.create("entities/CandidateClaim/CandidateClaim.errors");

const CandidateClaimConverterOperation = LiteralKit(["toInsert", "fromRow"]);

/**
 * Schema conversion failed while projecting a CandidateClaim across the
 * persistence boundary.
 *
 * **Example** (Construct converter error)
 *
 * ```ts
 * import { CandidateClaimConverterError } from "@beep/epistemic-tables/entities/CandidateClaim"
 *
 * const error = CandidateClaimConverterError.make({
 *   operation: "toInsert",
 *   reason: "schema conversion failed",
 * })
 * console.log(error.operation)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class CandidateClaimConverterError extends S.TaggedError<CandidateClaimConverterError>(
  $I`CandidateClaimConverterError`
)(
  "CandidateClaimConverterError",
  {
    operation: CandidateClaimConverterOperation.annotateKey({
      description: "Converter operation that failed.",
    }),
    reason: S.NonEmptyString.annotateKey({
      description: "Human-readable schema conversion failure.",
    }),
  },
  $I.annoteError<CandidateClaimConverterError>("CandidateClaimConverterError", {
    title: "CandidateClaim converter error",
    description: "Schema conversion failed while projecting a CandidateClaim across the persistence boundary.",
  })
) {
  /**
   * Lift a schema error into a {@link CandidateClaimConverterError}.
   *
   * **Example** (Lift schema error)
   *
   * ```ts
   * import { CandidateClaimConverterError } from "@beep/epistemic-tables/entities/CandidateClaim"
   *
   * const error = CandidateClaimConverterError.make({
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
    operation: typeof CandidateClaimConverterOperation.Type,
    error: S.SchemaError
  ): CandidateClaimConverterError {
    return CandidateClaimConverterError.make({
      operation,
      reason: error.message.length > 0 ? error.message : "schema conversion failed",
    });
  }
}
