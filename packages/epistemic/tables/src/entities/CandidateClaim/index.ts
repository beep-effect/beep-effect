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
 * import { getTableName } from "drizzle-orm"
 *
 * console.log(CandidateClaim.toCandidateClaimInsert)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export * from "./CandidateClaim.converters.ts";
/**
 * CandidateClaim converter error exports.
 *
 * **Example** (Access CandidateClaimConverterError export)
 *
 * ```ts
 * import * as CandidateClaim from "@beep/epistemic-tables/entities/CandidateClaim"
 *
 * console.log(CandidateClaim.CandidateClaimConverterError)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export * from "./CandidateClaim.errors.ts";
/**
 * CandidateClaim table exports.
 *
 * **Example** (Import table definition exports)
 *
 * ```ts
 * import * as CandidateClaim from "@beep/epistemic-tables/entities/CandidateClaim"
 *
 * console.log(getTableName(CandidateClaim.Table))
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export * from "./CandidateClaim.table.ts";
