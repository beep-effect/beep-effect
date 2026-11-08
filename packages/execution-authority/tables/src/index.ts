/**
 * Package entry point for `@beep/execution-authority-tables`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Execution authority tables grouped by entity.
 *
 * @category tables
 * @since 0.0.0
 */
export * as Entities from "./entities/index.ts";
/**
 * Drizzle schema aggregate for the execution authority slice.
 *
 * @category tables
 * @since 0.0.0
 */
export { DbSchema } from "./Schema.ts";
