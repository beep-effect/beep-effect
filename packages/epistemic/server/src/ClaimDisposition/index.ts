/**
 * Claim disposition server adapter entrypoint.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Claim disposition repository layer exports.
 *
 * **Example** (In-memory repository export)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import * as ClaimDisposition from "@beep/epistemic-server/ClaimDisposition"
 *
 * strictEqual(typeof ClaimDisposition.ClaimDispositionRepositoryInMemory, "object")
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export * from "./ClaimDisposition.layer.ts";
/**
 * Claim disposition repository adapter exports.
 *
 * **Example** (Drizzle repository factory export)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import * as ClaimDisposition from "@beep/epistemic-server/ClaimDisposition"
 *
 * strictEqual(typeof ClaimDisposition.makeDrizzleClaimDispositionRepository, "function")
 * ```
 *
 * @category repositories
 * @since 0.0.0
 */
export * from "./ClaimDisposition.repo.ts";
