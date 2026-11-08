/**
 * Server-only use-case exports for `@beep/execution-authority-use-cases`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Execution ledger error and repository port exports.
 *
 * **Example** (Check execution ledger type)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { ExecutionLedger } from "@beep/execution-authority-use-cases/server"
 *
 * strictEqual(typeof ExecutionLedger.ExecutionLedger, "function")
 * ```
 *
 * @category repositories
 * @since 0.0.0
 */
export * as ExecutionLedger from "./ExecutionLedger/index.ts";
