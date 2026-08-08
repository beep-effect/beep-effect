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
 * **Example** (Check disposition resolver type)
 *
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
 * **Example** (Check claim gate factory)
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
export * as ClaimGate from "./ClaimGate/index.ts";
/**
 * Claim lifecycle transition service contract exports.
 *
 * **Example** (Check transition factory type)
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
export * as ClaimLifecycle from "./ClaimLifecycle/index.ts";
/**
 * Contradiction-triage repository contracts.
 *
 * **Example** (Log triage repository export)
 *
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
 * **Example** (Check edge authority repository)
 *
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
 * **Example** (Check execution ledger type)
 *
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
