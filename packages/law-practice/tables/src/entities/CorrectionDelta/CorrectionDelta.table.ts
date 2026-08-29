/**
 * Law-practice CorrectionDelta table metadata.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { toPgTable } from "@beep/effect-drizzle/pg";
import { CorrectionDelta } from "@beep/law-practice-domain/entities/CorrectionDelta";

/**
 * PGLite/Postgres Drizzle table for appended corrections to a recorded reading.
 *
 * **Details**
 *
 * The columns are projected from the entity's `persisted` block, so the physical
 * name `law_practice_correction_delta` is derived from the entity id rather than
 * restated here.
 *
 * **Gotchas**
 *
 * A correction is never edited: revising one appends a further delta whose
 * `supersedes` names this row, which is what keeps the chain of who said what
 * about which element readable afterwards. Drizzle metadata cannot express that,
 * so the raw-SQL migration owns the trigger that rejects UPDATE and DELETE.
 *
 * **Example** (Read the projected table name)
 *
 * ```ts
 * import { CorrectionDelta } from "@beep/law-practice-tables/entities"
 * import { getTableName } from "drizzle-orm"
 *
 * console.log(getTableName(CorrectionDelta.Table)) // "law_practice_correction_delta"
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const Table = toPgTable(CorrectionDelta);
