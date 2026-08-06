/**
 * Law-practice IdsSubmissionFact table metadata.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { EntityTable } from "@beep/drizzle";
import { IdsSubmissionFact } from "@beep/law-practice-domain/entities/IdsSubmissionFact";

/**
 * PGLite/Postgres Drizzle table for recorded information-disclosure submission
 * facts.
 *
 * **Details**
 *
 * The columns are projected from the entity's `persisted` block, so the physical
 * name `law_practice_ids_submission_fact` is derived from the entity id rather
 * than restated here.
 *
 * **Gotchas**
 *
 * Every column records an observed fact, never a legal conclusion. A
 * supplemental or correcting submission is a separate row carrying its own
 * `operative_date`; editing an earlier row would destroy the date 37 CFR 1.97(i)
 * makes operative for subsequent timing.
 *
 * **Example** (Read the projected table name)
 *
 * ```ts
 * import { IdsSubmissionFact } from "@beep/law-practice-tables/entities"
 *
 * console.log(IdsSubmissionFact.Table.definition.tableName) // "law_practice_ids_submission_fact"
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const Table = EntityTable.pgTableFrom(IdsSubmissionFact);
