/**
 * Law-practice ActFrame table metadata.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { EntityTable } from "@beep/drizzle";
import { ActFrame } from "@beep/law-practice-domain/entities/ActFrame";

/**
 * PGLite/Postgres Drizzle table for recorded readings of a norm as an act.
 *
 * **Details**
 *
 * The columns are projected from the entity's `persisted` block, so the physical
 * name `law_practice_act_frame` is derived from the entity id rather than
 * restated here.
 *
 * **Gotchas**
 *
 * A frame is one interpreter's reading, so a second reading of the same
 * provision is a new row rather than an edit of this one. Drizzle metadata
 * cannot express that, so the raw-SQL migration owns the trigger that rejects
 * UPDATE and DELETE.
 *
 * **Example** (Read the projected table name)
 *
 * ```ts
 * import { ActFrame } from "@beep/law-practice-tables/entities"
 *
 * console.log(ActFrame.Table.definition.tableName) // "law_practice_act_frame"
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const Table = EntityTable.pgTableFrom(ActFrame);
