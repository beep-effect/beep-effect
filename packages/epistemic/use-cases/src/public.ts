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
 * **Example** (Empty claims projection total)
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
export * as ClaimProjection from "./ClaimProjection/index.ts";
/**
 * Contradiction-triage public contracts.
 *
 * **Example** (Log ReviewContradictionCandidate export)
 *
 * ```ts
 * import { ContradictionTriage } from "@beep/epistemic-use-cases/public"
 *
 * console.log(ContradictionTriage.ReviewContradictionCandidate)
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export * as ContradictionTriage from "./ContradictionTriage/index.ts";
/**
 * Direct client-safe contradiction-triage exports.
 *
 * @category use-cases
 * @since 0.0.0
 */
export * from "./ContradictionTriage/index.ts";
