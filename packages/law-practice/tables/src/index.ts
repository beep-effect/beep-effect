/**
 * Package entry point for `@beep/law-practice-tables`.
 *
 * @packageDocumentation
 * @category tables
 * @since 0.0.0
 */

/**
 * Package version for `@beep/law-practice-tables`.
 *
 * @example
 * ```ts
 * import { VERSION } from "@beep/law-practice-tables"
 *
 * console.log(VERSION) // "0.0.0"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const VERSION = "0.0.0" as const;

/**
 * Practice knowledge-graph entity table namespaces.
 *
 * @category tables
 * @since 0.0.0
 */
export * from "./entities/index.ts";
/**
 * Practice knowledge-graph read-model exports.
 *
 * @category models
 * @since 0.0.0
 */
export * from "./ReadModels.ts";
/**
 * Practice knowledge-graph table collection exports.
 *
 * @category tables
 * @since 0.0.0
 */
export * from "./Tables.ts";
