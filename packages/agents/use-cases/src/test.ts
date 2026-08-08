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
 *
 * const sdk = makeInMemoryProfessionalRuntimeSdk([])
 * console.log(sdk)
 * ```
 *
 * @category fixtures
 * @since 0.0.0
 */
export * from "./proof.ts";
