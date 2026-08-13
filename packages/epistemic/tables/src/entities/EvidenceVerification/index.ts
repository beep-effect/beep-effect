/**
 * EvidenceVerification table exports.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * EvidenceVerification row converter exports.
 *
 * **Example** (Import converter export type)
 *
 * ```ts
 * import * as EvidenceVerification from "@beep/epistemic-tables/entities/EvidenceVerification"
 * import { getTableName } from "drizzle-orm"
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
 * **Example** (Access table entity name)
 *
 * ```ts
 * import * as EvidenceVerification from "@beep/epistemic-tables/entities/EvidenceVerification"
 *
 * console.log(getTableName(EvidenceVerification.Table))
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export * from "./EvidenceVerification.table.ts";
