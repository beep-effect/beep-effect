/**
 * Epistemic ClaimDisposition table metadata.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { EntityTable } from "@beep/drizzle";
import { ClaimDisposition } from "@beep/epistemic-domain/entities/ClaimDisposition";

/**
 * PGLite/Postgres Drizzle table for the epistemic ClaimDisposition entity.
 *
 * **Example** (Log table definition name)
 *
 * ```ts
 * import { ClaimDisposition } from "@beep/epistemic-tables/entities"
 *
 * console.log(ClaimDisposition.Table.definition.tableName)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const Table = EntityTable.pgTableFrom(ClaimDisposition);
