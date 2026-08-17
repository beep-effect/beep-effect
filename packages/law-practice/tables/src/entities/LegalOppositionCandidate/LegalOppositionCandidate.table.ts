/**
 * Law-practice LegalOppositionCandidate table metadata.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { toPgTable } from "@beep/effect-drizzle/pg";
import { LegalOppositionCandidate } from "@beep/law-practice-domain/entities/LegalOppositionCandidate";

/**
 * PGLite/Postgres Drizzle table for screened opposition candidates.
 *
 * **Details**
 *
 * The columns are projected from the entity's `persisted` block, so the physical
 * name `law_practice_legal_opposition_candidate` is derived from the entity id
 * rather than restated here.
 *
 * **Gotchas**
 *
 * A row records that two relations were screened as prima facie opposed, and
 * nothing about it is a finding. The pair inside `candidate` is an unordered
 * set, and `priority_basis` holds one party's asserted basis, so no query over
 * this table can produce a ranking between the two positions.
 *
 * A candidate is never edited: a second party's basis and a later verdict-family
 * assignment are their own appended rows. Drizzle metadata cannot express that,
 * so the raw-SQL migration owns the trigger that rejects UPDATE and DELETE.
 *
 * **Example** (Read the projected table name)
 *
 * ```ts
 * import { LegalOppositionCandidate } from "@beep/law-practice-tables/entities"
 * import { getTableName } from "drizzle-orm"
 *
 * console.log(getTableName(LegalOppositionCandidate.Table)) // "law_practice_legal_opposition_candidate"
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const Table = toPgTable(LegalOppositionCandidate);
