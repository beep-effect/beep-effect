/**
 * Law-practice PowerExercise table metadata.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { EntityTable } from "@beep/drizzle";
import { PowerExercise } from "@beep/law-practice-domain/entities/PowerExercise";

/**
 * PGLite/Postgres Drizzle table for recorded attempts to exercise a power.
 *
 * **Details**
 *
 * The columns are projected from the entity's `persisted` block, so the physical
 * name `law_practice_power_exercise` is derived from the entity id rather than
 * restated here.
 *
 * **Gotchas**
 *
 * Rows are attempts, not effects. An act later determined to have been beyond
 * the actor's power stays here with no position effect, because a deleted
 * attempt would leave no trace that anybody tried. The raw-SQL migration owns
 * the trigger that rejects UPDATE and DELETE; a later determination about the
 * same attempt is recorded, never written over this row.
 *
 * **Example** (Read the projected table name)
 *
 * ```ts
 * import { PowerExercise } from "@beep/law-practice-tables/entities"
 *
 * console.log(PowerExercise.Table.definition.tableName) // "law_practice_power_exercise"
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const Table = EntityTable.pgTableFrom(PowerExercise);
