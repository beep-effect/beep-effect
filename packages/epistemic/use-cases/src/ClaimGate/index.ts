/**
 * Package entrypoint.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Claim gate port exports.
 *
 * **Example** (ClaimGate is a function)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import * as ClaimGate from "@beep/epistemic-use-cases/ClaimGate"
 *
 * strictEqual(typeof ClaimGate.ClaimGate, "function")
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export * from "./ClaimGate.ports.ts";
/**
 * Claim gate implementation exports.
 *
 * **Example** (makeClaimGate is a function)
 *
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
export * from "./ClaimGate.service.ts";
