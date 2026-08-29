/**
 * Epistemic Evidence table metadata.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Evidence row converter exports.
 *
 * **Example** (Log toEvidenceInsert converter)
 *
 * ```ts
 * import * as Evidence from "@beep/epistemic-tables/entities/Evidence"
 * import { getTableName } from "drizzle-orm"
 *
 * console.log(Evidence.toEvidenceInsert)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export * from "./Evidence.converters.ts";
/**
 * Evidence table exports.
 *
 * **Example** (Log table entity type)
 *
 * ```ts
 * import * as Evidence from "@beep/epistemic-tables/entities/Evidence"
 *
 * console.log(getTableName(Evidence.Table))
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export * from "./Evidence.table.ts";
