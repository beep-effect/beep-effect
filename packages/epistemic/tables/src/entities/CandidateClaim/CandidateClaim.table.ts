/**
 * Epistemic CandidateClaim table metadata.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { toPgTable } from "@beep/effect-drizzle/pg";
import { CandidateClaim } from "@beep/epistemic-domain/entities/CandidateClaim";

/**
 * PGLite/Postgres Drizzle table for the epistemic CandidateClaim entity.
 *
 * **Example** (Log table definition name)
 *
 * ```ts
 * import { CandidateClaim } from "@beep/epistemic-tables/entities"
 * import { getTableName } from "drizzle-orm"
 *
 * console.log(getTableName(CandidateClaim.Table))
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const Table = toPgTable(CandidateClaim);
