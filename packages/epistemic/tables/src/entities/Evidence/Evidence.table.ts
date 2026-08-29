/**
 * Epistemic Evidence table metadata.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { toPgTable } from "@beep/effect-drizzle/pg";
import { Evidence } from "@beep/epistemic-domain/entities/Evidence";

/**
 * PGLite/Postgres Drizzle table for the epistemic Evidence entity.
 *
 * **Example** (Log Evidence table name)
 *
 * ```ts
 * import { Evidence } from "@beep/epistemic-tables/entities"
 * import { getTableName } from "drizzle-orm"
 *
 * console.log(getTableName(Evidence.Table))
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const Table = toPgTable(Evidence);
