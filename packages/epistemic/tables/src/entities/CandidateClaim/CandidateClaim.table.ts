/**
 * Epistemic CandidateClaim table metadata.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { EntityTable } from "@beep/drizzle";
import { CandidateClaim } from "@beep/epistemic-domain/entities/CandidateClaim";

/**
 * PGLite/Postgres Drizzle table for the epistemic CandidateClaim entity.
 *
 * **Example** (Log table definition name)
 *
 * ```ts
 * import { CandidateClaim } from "@beep/epistemic-tables/entities"
 *
 * console.log(CandidateClaim.Table.definition.tableName)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const Table = EntityTable.pgTableFrom(CandidateClaim);
