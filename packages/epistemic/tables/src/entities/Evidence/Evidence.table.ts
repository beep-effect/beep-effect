/**
 * Epistemic Evidence table metadata.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { EntityTable } from "@beep/drizzle";
import { Evidence } from "@beep/epistemic-domain/entities/Evidence";

/**
 * PGLite/Postgres Drizzle table for the epistemic Evidence entity.
 *
 * @example
 * ```ts
 * import { Evidence } from "@beep/epistemic-tables/entities"
 *
 * console.log(Evidence.Table.definition.tableName)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const Table = EntityTable.pgTableFrom(Evidence);
