/**
 * Epistemic ClaimDisposition table metadata.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { toPgTable } from "@beep/effect-drizzle/pg";
import { ClaimDisposition } from "@beep/epistemic-domain/entities/ClaimDisposition";

/**
 * PGLite/Postgres Drizzle table for the epistemic ClaimDisposition entity.
 *
 * **Example** (Log table definition name)
 *
 * ```ts
 * import { ClaimDisposition } from "@beep/epistemic-tables/entities"
 * import { getTableName } from "drizzle-orm"
 *
 * console.log(getTableName(ClaimDisposition.Table))
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const Table = toPgTable(ClaimDisposition);
