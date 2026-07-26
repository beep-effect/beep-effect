/**
 * Epistemic ClaimDisposition table metadata.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * ClaimDisposition row converter exports.
 *
 * @example
 * ```ts
 * import * as ClaimDisposition from "@beep/epistemic-tables/entities/ClaimDisposition"
 *
 * console.log(ClaimDisposition.toClaimDispositionInsert)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export * from "./ClaimDisposition.converters.ts";
/**
 * ClaimDisposition table exports.
 *
 * @example
 * ```ts
 * import * as ClaimDisposition from "@beep/epistemic-tables/entities/ClaimDisposition"
 *
 * console.log(ClaimDisposition.Table.definition.entityId.entityType)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export * from "./ClaimDisposition.table.ts";
