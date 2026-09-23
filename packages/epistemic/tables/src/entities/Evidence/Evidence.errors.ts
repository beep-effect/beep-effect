/**
 * Evidence row-converter errors.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $EpistemicTablesId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $EpistemicTablesId.create("entities/Evidence/Evidence.errors");

const EvidenceConverterOperation = LiteralKit(["toInsert", "fromRow"]);

/**
 * Schema conversion failed while projecting an Evidence across the persistence
 * boundary.
 *
 * **Example** (Construct converter error)
 *
 * ```ts
 * import { EvidenceConverterError } from "@beep/epistemic-tables/entities/Evidence"
 *
 * const error = EvidenceConverterError.make({
 *   operation: "toInsert",
 *   reason: "schema conversion failed",
 * })
 * console.log(error.operation)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class EvidenceConverterError extends S.TaggedError<EvidenceConverterError>($I`EvidenceConverterError`)(
  "EvidenceConverterError",
  {
    operation: EvidenceConverterOperation.annotateKey({
      description: "Converter operation that failed.",
    }),
    reason: S.NonEmptyString.annotateKey({
      description: "Human-readable schema conversion failure.",
    }),
  },
  $I.annoteError<EvidenceConverterError>("EvidenceConverterError", {
    title: "Evidence converter error",
    description: "Schema conversion failed while projecting an Evidence across the persistence boundary.",
  })
) {
  /**
   * Lift a schema error into an {@link EvidenceConverterError}.
   *
   * **Example** (Lift schema error)
   *
   * ```ts
   * import { EvidenceConverterError } from "@beep/epistemic-tables/entities/Evidence"
   *
   * const error = EvidenceConverterError.make({
   *   operation: "fromRow",
   *   reason: "invalid row",
   * })
   * console.log(error.operation)
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static fromSchema(operation: typeof EvidenceConverterOperation.Type, error: S.SchemaError): EvidenceConverterError {
    return EvidenceConverterError.make({
      operation,
      reason: error.message.length > 0 ? error.message : "schema conversion failed",
    });
  }
}
