/**
 * Package entrypoint.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Claim projection contract exports.
 *
 * **Example** (Project empty claims)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import * as ClaimProjection from "@beep/epistemic-use-cases/ClaimProjection"
 *
 * strictEqual(ClaimProjection.projectClaims([]).total, 0)
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export * from "./ClaimProjection.ts";
