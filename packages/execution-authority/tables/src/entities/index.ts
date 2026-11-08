/**
 * Execution authority table exports, grouped by entity.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Execution decision and outcome ledger tables, converters and errors.
 *
 * **Example** (Read the decision table name)
 *
 * ```ts
 * import { ExecutionRecord } from "@beep/execution-authority-tables/entities"
 *
 * console.log(ExecutionRecord.EXECUTION_DECISION_TABLE_NAME)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export * as ExecutionRecord from "./ExecutionRecord/index.ts";
