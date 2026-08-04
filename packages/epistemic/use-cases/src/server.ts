/**
 * Server-only epistemic use-case exports (product service contracts).
 *
 * @packageDocumentation
 * @category services
 * @since 0.0.0
 */

/**
 * Claim disposition port and gate-outcome resolution exports.
 *
 * @example
 * ```ts
 * import { strictEqual } from "node:assert"
 * import * as ClaimDisposition from "@beep/epistemic-use-cases/ClaimDisposition"
 *
 * strictEqual(typeof ClaimDisposition.makeClaimGateOutcomeResolver, "function")
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export * as ClaimDisposition from "./ClaimDisposition/index.ts";
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
/**
 * Contradiction-triage repository contracts.
 *
 * @example
 * ```ts
 * import { ContradictionTriage } from "@beep/epistemic-use-cases/server"
 *
 * console.log(ContradictionTriage.ContradictionTriageRepository)
 * ```
 *
 * @category repositories
 * @since 0.0.0
 */
export * as ContradictionTriage from "./ContradictionTriage/server.ts";
/**
 * Direct server-only contradiction-triage exports.
 *
 * @category services
 * @since 0.0.0
 */
export * from "./ContradictionTriage/server.ts";
/**
 * Bitemporal edge authority command, error, and repository port exports.
 *
 * @example
 * ```ts
 * import { strictEqual } from "node:assert"
 * import * as EdgeAuthority from "@beep/epistemic-use-cases/EdgeAuthority"
 *
 * strictEqual(typeof EdgeAuthority.EdgeAuthorityRepository, "function")
 * ```
 *
 * @category repositories
 * @since 0.0.0
 */
export * as EdgeAuthority from "./EdgeAuthority/index.ts";
/**
 * Direct server-only edge-authority exports.
 *
 * @category repositories
 * @since 0.0.0
 */
export * from "./EdgeAuthority/index.ts";
/**
 * Execution ledger error and repository port exports.
 *
 * @example
 * ```ts
 * import { strictEqual } from "node:assert"
 * import * as ExecutionLedger from "@beep/epistemic-use-cases/ExecutionLedger"
 *
 * strictEqual(typeof ExecutionLedger.ExecutionLedger, "function")
 * ```
 *
 * @category repositories
 * @since 0.0.0
 */
export * as ExecutionLedger from "./ExecutionLedger/index.ts";
