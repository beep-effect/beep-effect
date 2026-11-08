/**
 * Execution authority entities: the hash-chained decision and outcome records.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Execution ledger record entity exports.
 *
 * **Example** (Log completed settlement status)
 *
 * ```ts
 * import { ExecutionSettlement } from "@beep/execution-authority-domain/entities"
 *
 * console.log(ExecutionSettlement.Enum.completed)
 * ```
 *
 * @category entities
 * @since 0.0.0
 */
export * from "./ExecutionRecord/index.ts";
