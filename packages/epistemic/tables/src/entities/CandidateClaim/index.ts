/**
 * Epistemic CandidateClaim table metadata.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
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
