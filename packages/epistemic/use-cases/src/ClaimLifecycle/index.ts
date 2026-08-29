/**
 * Package entrypoint.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Claim lifecycle transition service exports.
 *
 * **Example** (Assert makeClaimTransition is function)
 *
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
export * from "./ClaimLifecycle.service.ts";
