/**
 * Package entry point for `@beep/epistemic-use-cases`.
 *
 * @packageDocumentation
 * @category use-cases
 * @since 0.0.0
 */

/**
 * Package version for the epistemic use-case role.
 *
 * @example
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { VERSION } from "@beep/epistemic-use-cases"
 *
 * strictEqual(VERSION, "0.0.0")
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const VERSION = "0.0.0" as const;

/**
 * Public epistemic use-case exports.
 *
 * @category use-cases
 * @since 0.0.0
 */
export * from "./public.ts";
