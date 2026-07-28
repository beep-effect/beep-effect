/**
 * Practice knowledge-graph Drizzle schema collection.
 *
 * Composition lives in `ReadModels.ts` (the read-model composer); this module
 * re-exports it for the `./tables` subpath.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * @category tables
 * @since 0.0.0
 */
export { DbSchema } from "./ReadModels.ts";
