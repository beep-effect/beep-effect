/**
 * Law-practice PatentCitationEvent table metadata.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { toPgTable } from "@beep/effect-drizzle/pg";
import { PatentCitationEvent } from "@beep/law-practice-domain/entities/PatentCitationEvent";

/**
 * PGLite/Postgres Drizzle table for recorded patent citation observations.
 *
 * **Details**
 *
 * The columns are projected from the entity's `persisted` block, so the physical
 * name `law_practice_patent_citation_event` is derived from the entity id rather
 * than restated here.
 *
 * **Gotchas**
 *
 * The append-only guarantee this table sells is owned by the raw-SQL migration,
 * not by Drizzle metadata: ProductEntity still contributes `row_version`,
 * `updated_at`, and `updated_by_principal` columns that no writer may move.
 *
 * **Example** (Read the projected table name)
 *
 * ```ts
 * import { PatentCitationEvent } from "@beep/law-practice-tables/entities"
 * import { getTableName } from "drizzle-orm"
 *
 * console.log(getTableName(PatentCitationEvent.Table)) // "law_practice_patent_citation_event"
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const Table = toPgTable(PatentCitationEvent);
