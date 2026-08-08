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

import { EntityTable } from "@beep/drizzle";
import { EdgeVersion } from "@beep/epistemic-domain/entities/EdgeVersion";

/**
 * PGLite/Postgres Drizzle table for the epistemic EdgeVersion entity.
 *
 * **Example** (Log EdgeVersion table name)
 *
 * ```ts
 * import { EdgeVersion } from "@beep/epistemic-tables/entities"
 *
 * console.log(EdgeVersion.Table.definition.tableName)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const Table = EntityTable.pgTableFrom(EdgeVersion);
