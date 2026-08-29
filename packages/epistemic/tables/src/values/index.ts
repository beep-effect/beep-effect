/**
 * Epistemic value-record table namespaces.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Execution ledger table metadata namespace.
 *
 * **Example** (Access execution table name)
 *
 * ```ts
 * import { ExecutionRecord } from "@beep/epistemic-tables/values"
 *
 * console.log(ExecutionRecord.EXECUTION_DECISION_TABLE_NAME)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export * as ExecutionRecord from "./ExecutionRecord/index.ts";
