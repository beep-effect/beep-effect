/**
 * Execution ledger row-converter errors.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ExecutionAuthorityTablesId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $ExecutionAuthorityTablesId.create("entities/ExecutionRecord/ExecutionRecord.errors");

const ExecutionRecordConverterOperation = LiteralKit([
  "toDecisionInsert",
  "fromDecisionRow",
  "toOutcomeInsert",
  "fromOutcomeRow",
]);

/**
 * Schema conversion failed while projecting an execution ledger record across
 * the persistence boundary.
 *
 * **Example** (Construct converter error)
 *
 * ```ts
 * import { ExecutionRecordConverterError } from "@beep/execution-authority-tables/entities/ExecutionRecord"
 *
 * const error = ExecutionRecordConverterError.make({
 *   operation: "toDecisionInsert",
 *   reason: "schema conversion failed",
 * })
 * console.log(error.operation)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class ExecutionRecordConverterError extends S.TaggedError<
  ExecutionRecordConverterError,
  { readonly brand: unique symbol }
>($I`ExecutionRecordConverterError`)(
  "ExecutionRecordConverterError",
  {
    operation: ExecutionRecordConverterOperation.annotateKey({
      description: "Converter operation that failed.",
    }),
    reason: S.NonEmptyString.annotateKey({
      description: "Human-readable schema conversion failure.",
    }),
  },
  $I.annoteError<ExecutionRecordConverterError>("ExecutionRecordConverterError", {
    title: "ExecutionRecord converter error",
    description:
      "Schema conversion failed while projecting an execution ledger record across the persistence boundary.",
  })
) {
  /**
   * Lift a schema error into a {@link ExecutionRecordConverterError}.
   *
   * **Example** (Lift schema error)
   *
   * ```ts
   * import { ExecutionRecordConverterError } from "@beep/execution-authority-tables/entities/ExecutionRecord"
   *
   * const error = ExecutionRecordConverterError.make({
   *   operation: "fromDecisionRow",
   *   reason: "invalid row",
   * })
   * console.log(error.operation)
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static fromSchema(
    operation: typeof ExecutionRecordConverterOperation.Type,
    error: S.SchemaError
  ): ExecutionRecordConverterError {
    return ExecutionRecordConverterError.make({
      operation,
      reason: error.message.length > 0 ? error.message : "schema conversion failed",
    });
  }
}
