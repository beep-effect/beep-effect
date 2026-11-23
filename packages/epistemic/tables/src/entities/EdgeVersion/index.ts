/**
 * Epistemic EdgeVersion table metadata.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * **Example** (Access toEdgeVersionInsert export)
 *
 * ```ts
 * import * as EdgeVersion from "@beep/epistemic-tables/entities/EdgeVersion"
 * import { getTableName } from "drizzle-orm"
 *
 * console.log(EdgeVersion.toEdgeVersionInsert)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export * from "./EdgeVersion.converters.ts";
/**
 * **Example** (Access EdgeVersionConverterError export)
 *
 * ```ts
 * import * as EdgeVersion from "@beep/epistemic-tables/entities/EdgeVersion"
 *
 * console.log(EdgeVersion.EdgeVersionConverterError)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export * from "./EdgeVersion.errors.ts";
/**
 * **Example** (Access Table entityType)
 *
 * ```ts
 * import * as EdgeVersion from "@beep/epistemic-tables/entities/EdgeVersion"
 *
 * console.log(getTableName(EdgeVersion.Table))
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export * from "./EdgeVersion.table.ts";
