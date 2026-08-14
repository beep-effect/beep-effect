/**
 * Deterministic runtime fixture test helpers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Test-facing re-export of deterministic proof helpers.
 *
 * **Example** (Create in-memory SDK)
 *
 * ```ts
 * import { makeInMemoryProfessionalRuntimeSdk } from "@beep/agents-use-cases/test"
 * import { PromotionGateVerdict } from "@beep/shared-use-cases/PromotionGate"
 * import { Effect } from "effect"
 *
 * const sdk = makeInMemoryProfessionalRuntimeSdk({
 *   fixtures: [],
 *   promotionGate: { evaluate: () => Effect.succeed(PromotionGateVerdict.cases.clear.make({})) }
 * })
 * console.log(sdk)
 * ```
 *
 * @category fixtures
 * @since 0.0.0
 */
export * from "./proof.ts";
