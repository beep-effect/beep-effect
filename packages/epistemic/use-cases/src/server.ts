/**
 * Server-only epistemic use-case exports (product service contracts).
 *
 * @packageDocumentation
 * @category services
 * @since 0.0.0
 */

/**
 * Claim gate service contract exports.
 *
 * @example
 * ```ts
 * import { strictEqual } from "node:assert"
 * import * as ClaimGate from "@beep/epistemic-use-cases/ClaimGate"
 *
 * strictEqual(typeof ClaimGate.makeClaimGate, "function")
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export * as ClaimGate from "./ClaimGate/index.ts";
/**
 * Claim lifecycle transition service contract exports.
 *
 * @example
 * ```ts
 * import { strictEqual } from "node:assert"
 * import * as ClaimLifecycle from "@beep/epistemic-use-cases/ClaimLifecycle"
 *
 * strictEqual(typeof ClaimLifecycle.makeClaimTransition, "function")
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export * as ClaimLifecycle from "./ClaimLifecycle/index.ts";
