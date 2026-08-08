/**
 * Epistemic UsageRecord table metadata.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { EntityTable } from "@beep/drizzle";
import { UsageRecord } from "@beep/epistemic-domain/entities/UsageRecord";

/**
 * PGLite/Postgres Drizzle table for the epistemic UsageRecord entity.
 *
 * **Example** (Log table definition name)
 *
 * ```ts
 * import { UsageRecord } from "@beep/epistemic-tables/entities"
 *
 * console.log(UsageRecord.Table.definition.tableName)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const Table = EntityTable.pgTableFrom(UsageRecord);
