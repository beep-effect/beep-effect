/**
 * Law-practice LegalPositionRelator table metadata.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { toPgTable } from "@beep/effect-drizzle/pg";
import { LegalPositionRelator } from "@beep/law-practice-domain/entities/LegalPositionRelator";

/**
 * PGLite/Postgres Drizzle table for stored advantage-side legal relations.
 *
 * **Details**
 *
 * The columns are projected from the entity's `persisted` block, so the physical
 * name `law_practice_legal_position_relator` is derived from the entity id
 * rather than restated here.
 *
 * **Gotchas**
 *
 * Exactly one relation is stored per row and it is always the advantage side.
 * There is no correlative row and there never will be: the correlative and
 * opposite readings are derived views, and persisting one would let it be
 * superseded while the relation it came from still stands.
 *
 * A stored relation is never edited. Drizzle metadata cannot express that, so
 * the raw-SQL migration owns the trigger that rejects UPDATE and DELETE.
 *
 * **Example** (Read the projected table name)
 *
 * ```ts
 * import { LegalPositionRelator } from "@beep/law-practice-tables/entities"
 * import { getTableName } from "drizzle-orm"
 *
 * console.log(getTableName(LegalPositionRelator.Table)) // "law_practice_legal_position_relator"
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const Table = toPgTable(LegalPositionRelator);
