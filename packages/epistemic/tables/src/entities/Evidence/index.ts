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
 * console.log(Evidence.Table.definition.entityId.entityType)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export * from "./Evidence.table.ts";
