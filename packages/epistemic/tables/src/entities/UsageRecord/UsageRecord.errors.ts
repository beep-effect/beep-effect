/**
 * UsageRecord row-converter errors.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $EpistemicTablesId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $EpistemicTablesId.create("entities/UsageRecord/UsageRecord.errors");

const UsageRecordConverterOperation = LiteralKit(["toInsert", "fromRow"]);

/**
 * Schema conversion failed while projecting a UsageRecord across the
 * persistence boundary.
 *
 * **Example** (Construct converter error)
 *
 * ```ts
 * import { UsageRecordConverterError } from "@beep/epistemic-tables/entities/UsageRecord"
 *
 * const error = UsageRecordConverterError.make({
 *   operation: "toInsert",
 *   reason: "schema conversion failed",
 * })
 * console.log(error.operation)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class UsageRecordConverterError extends S.TaggedError<UsageRecordConverterError>($I`UsageRecordConverterError`)(
  "UsageRecordConverterError",
  {
    operation: UsageRecordConverterOperation.annotateKey({
      description: "Converter operation that failed.",
    }),
    reason: S.NonEmptyString.annotateKey({
      description: "Human-readable schema conversion failure.",
    }),
  },
  $I.annoteError<UsageRecordConverterError>("UsageRecordConverterError", {
    title: "UsageRecord converter error",
    description: "Schema conversion failed while projecting a UsageRecord across the persistence boundary.",
  })
) {
  /**
   * Lift a schema error into a {@link UsageRecordConverterError}.
   *
   * **Example** (Lift schema error)
   *
   * ```ts
   * import { UsageRecordConverterError } from "@beep/epistemic-tables/entities/UsageRecord"
   *
   * const error = UsageRecordConverterError.make({
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
    operation: typeof UsageRecordConverterOperation.Type,
    error: S.SchemaError
  ): UsageRecordConverterError {
    return UsageRecordConverterError.make({
      operation,
      reason: error.message.length > 0 ? error.message : "schema conversion failed",
    });
  }
}
