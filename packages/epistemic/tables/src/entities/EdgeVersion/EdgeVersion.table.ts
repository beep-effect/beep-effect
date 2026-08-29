/**
 * Epistemic EdgeVersion table metadata.
 *
 * The bitemporal constraints that make this table trustworthy — the ordered
 * interval CHECK constraints, the endpoint-kind CHECK constraints, the `logical_key` exclusion
 * constraint, and the open-head partial unique index — are owned by the raw-SQL
 * migration rather than by Drizzle metadata, because Drizzle cannot express
 * them. This projection publishes the columns; the migration publishes the
 * invariants.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { toPgTable } from "@beep/effect-drizzle/pg";
import { EdgeVersion } from "@beep/epistemic-domain/entities/EdgeVersion";

/**
 * PGLite/Postgres Drizzle table for the epistemic EdgeVersion entity.
 *
 * **Example** (Log EdgeVersion table name)
 *
 * ```ts
 * import { EdgeVersion } from "@beep/epistemic-tables/entities"
 * import { getTableName } from "drizzle-orm"
 *
 * console.log(getTableName(EdgeVersion.Table))
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const Table = toPgTable(EdgeVersion);
