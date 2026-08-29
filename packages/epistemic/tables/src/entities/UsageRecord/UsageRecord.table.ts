/**
 * Epistemic UsageRecord table metadata.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { toPgTable } from "@beep/effect-drizzle/pg";
import { UsageRecord } from "@beep/epistemic-domain/entities/UsageRecord";
import { getTableName } from "drizzle-orm";

/**
 * PGLite/Postgres Drizzle table for the epistemic UsageRecord entity.
 *
 * **Example** (Log table definition name)
 *
 * ```ts
 * import { UsageRecord } from "@beep/epistemic-tables/entities"
 *
 * console.log(UsageRecord.TABLE_NAME)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const Table = toPgTable(UsageRecord);

/**
 * Physical Postgres table name for usage records.
 *
 * **Example** (Read table name)
 *
 * ```ts
 * import { TABLE_NAME } from "@beep/epistemic-tables/entities/UsageRecord"
 *
 * console.log(TABLE_NAME)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const TABLE_NAME = getTableName(Table);
