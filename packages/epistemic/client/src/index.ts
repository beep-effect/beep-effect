/**
 * Package entry point for `@beep/epistemic-client`.
 *
 * @packageDocumentation
 * @category clients
 * @since 0.0.0
 */

/**
 * Package version for `@beep/epistemic-client`.
 *
 * @example
 * ```ts
 * import { VERSION } from "@beep/epistemic-client"
 *
 * const expectedVersion: typeof VERSION = "0.0.0"
 * const isExpectedVersion = VERSION === expectedVersion
 * console.log(isExpectedVersion) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const VERSION = "0.0.0" as const;

/**
 * Contradiction-triage client state and authenticated RPC client exports.
 *
 * @category clients
 * @since 0.0.0
 */
export * from "./ContradictionTriage/index.ts";
/**
 * Epistemic RPC transport selection.
 *
 * @category protocols
 * @since 0.0.0
 */
export * from "./Protocol.ts";
