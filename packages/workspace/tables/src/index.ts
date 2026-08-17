/**
 * Workspace persistence boundary for metadata-only table projections.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Workspace entity table metadata namespaces.
 *
 * **Example** (Log entity table name)
 *
 * ```ts
 * import { Entities } from "@beep/workspace-tables"
 *
 * console.log(Entities.CandidateDraft.TABLE_NAME)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export * as Entities from "./entities/index.ts";
/**
 * Workspace Drizzle schema aggregate exports.
 *
 * @since 0.0.0
 * @category tables
 */
export { DbSchema } from "./Schema.ts";
