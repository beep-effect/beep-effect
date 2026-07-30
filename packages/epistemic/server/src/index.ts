/**
 * Package entry point for `@beep/epistemic-server`.
 *
 * @packageDocumentation
 * @category layers
 * @since 0.0.0
 */

/**
 * Package version for the epistemic server role.
 *
 * @example
 * ```ts
 * import { VERSION } from "@beep/epistemic-server"
 *
 * console.log(VERSION)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const VERSION = "0.0.0" as const;

/**
 * Claim disposition server adapter exports.
 *
 * @category repositories
 * @since 0.0.0
 */
export * from "./ClaimDisposition/index.ts";
/**
 * Edge authority server adapter exports.
 *
 * @category repositories
 * @since 0.0.0
 */
export * from "./EdgeAuthority/index.ts";
/**
 * Execution ledger server adapter exports.
 *
 * @category repositories
 * @since 0.0.0
 */
export * from "./ExecutionLedger/index.ts";
/**
 * Governed egress exports.
 *
 * @category services
 * @since 0.0.0
 */
export * from "./GovernedEgress/index.ts";
/**
 * Governed tier gate exports.
 *
 * @category services
 * @since 0.0.0
 */
export * from "./GovernedTierGate/index.ts";
/**
 * Epistemic server layer exports.
 *
 * @category layers
 * @since 0.0.0
 */
export * from "./Layer.ts";
