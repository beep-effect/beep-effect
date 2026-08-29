/**
 * Epistemic ClaimDisposition table metadata.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * ClaimDisposition row converter exports.
 *
 * **Example** (Import row converter exports)
 *
 * ```ts
 * import * as ClaimDisposition from "@beep/epistemic-tables/entities/ClaimDisposition"
 * import { getTableName } from "drizzle-orm"
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
 * **Example** (Import table definition exports)
 *
 * ```ts
 * import * as ClaimDisposition from "@beep/epistemic-tables/entities/ClaimDisposition"
 *
 * console.log(getTableName(ClaimDisposition.Table))
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export * from "./ClaimDisposition.table.ts";
