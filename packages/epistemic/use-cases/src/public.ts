/**
 * Public (client-safe) epistemic use-case exports.
 *
 * @packageDocumentation
 * @category use-cases
 * @since 0.0.0
 */

/**
 * Claim projection pure read-model exports.
 *
 * @example
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
export * as ClaimProjection from "./ClaimProjection/index.ts";
