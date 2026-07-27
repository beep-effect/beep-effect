/**
 * Package entry point for `@beep/law-practice-server`.
 *
 * @packageDocumentation
 * @category layers
 * @since 0.0.0
 */

/**
 * Package version for the law-practice server role.
 *
 * @example
 * ```ts
 * import { VERSION } from "@beep/law-practice-server"
 *
 * console.log(VERSION)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const VERSION = "0.0.0" as const;

/**
 * Law-practice server layer exports.
 *
 * @category layers
 * @since 0.0.0
 */
export * from "./Layer.ts";
/**
 * @category errors
 * @since 0.0.0
 */
export * from "./PracticeKg.errors.ts";
/**
 * @category services
 * @since 0.0.0
 */
export * from "./PracticeKg.projections.ts";
/**
 * @category schemas
 * @since 0.0.0
 */
export * from "./PracticeKg.schemas.ts";
/**
 * @category handlers
 * @since 0.0.0
 */
export * from "./PracticeKg.tool-handlers.ts";
/**
 * @category tools
 * @since 0.0.0
 */
export * from "./Tools.ts";
