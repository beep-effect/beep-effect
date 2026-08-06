/**
 * Law-practice PatentCitationEvent table metadata.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { EntityTable } from "@beep/drizzle";
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
 * not by Drizzle metadata: `BaseEntity` still contributes `row_version`,
 * `updated_at`, and `updated_by_principal` columns that no writer may move.
 *
 * **Example** (Read the projected table name)
 *
 * ```ts
 * import { PatentCitationEvent } from "@beep/law-practice-tables/entities"
 *
 * console.log(PatentCitationEvent.Table.definition.tableName) // "law_practice_patent_citation_event"
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const Table = EntityTable.pgTableFrom(PatentCitationEvent);
