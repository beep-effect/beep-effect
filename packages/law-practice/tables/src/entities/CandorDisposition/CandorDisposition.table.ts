/**
 * Law-practice CandorDisposition table metadata.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { EntityTable } from "@beep/drizzle";
import { CandorDisposition } from "@beep/law-practice-domain/entities/CandorDisposition";

/**
 * PGLite/Postgres Drizzle table for recorded attorney candor judgments.
 *
 * **Details**
 *
 * The columns are projected from the entity's `persisted` block, so the physical
 * name `law_practice_candor_disposition` is derived from the entity id rather
 * than restated here.
 *
 * **Gotchas**
 *
 * A recorded disposition is never edited: revision appends a new row whose
 * `supersedes` names the prior one. Drizzle metadata cannot express that, so the
 * raw-SQL migration owns the trigger that rejects UPDATE and DELETE.
 *
 * **Example** (Read the projected table name)
 *
 * ```ts
 * import { CandorDisposition } from "@beep/law-practice-tables/entities"
 *
 * console.log(CandorDisposition.Table.definition.tableName) // "law_practice_candor_disposition"
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const Table = EntityTable.pgTableFrom(CandorDisposition);
