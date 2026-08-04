/**
 * EvidenceVerification table exports.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * EvidenceVerification row converter exports.
 *
 * @example
 * ```ts
 * import * as EvidenceVerification from "@beep/epistemic-tables/entities/EvidenceVerification"
 *
 * console.log(typeof EvidenceVerification.toEvidenceVerificationInsert)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export * from "./EvidenceVerification.converters.ts";
/**
 * EvidenceVerification table metadata exports.
 *
 * @example
 * ```ts
 * import * as EvidenceVerification from "@beep/epistemic-tables/entities/EvidenceVerification"
 *
 * console.log(EvidenceVerification.Table.definition.entityId.tableName)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export * from "./EvidenceVerification.table.ts";
