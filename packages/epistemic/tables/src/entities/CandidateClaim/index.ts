/**
 * Epistemic CandidateClaim table metadata.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * CandidateClaim row converter exports.
 *
 * **Example** (Import row converter exports)
 *
 * ```ts
 * import * as CandidateClaim from "@beep/epistemic-tables/entities/CandidateClaim"
 *
 * console.log(CandidateClaim.toCandidateClaimInsert)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export * from "./CandidateClaim.converters.ts";
/**
 * CandidateClaim table exports.
 *
 * **Example** (Import table definition exports)
 *
 * ```ts
 * import * as CandidateClaim from "@beep/epistemic-tables/entities/CandidateClaim"
 *
 * console.log(CandidateClaim.Table.definition.entityId.entityType)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export * from "./CandidateClaim.table.ts";
