/**
 * Workspace CandidateDraft table metadata.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { toPgTable } from "@beep/effect-drizzle/pg";
import { CandidateDraft } from "@beep/workspace-domain/entities/CandidateDraft";
import { getTableName } from "drizzle-orm";

/**
 * PGLite/Postgres Drizzle table for the workspace CandidateDraft entity.
 *
 * **Example** (Read CandidateDraft table metadata)
 *
 * ```ts
 * import { CandidateDraft } from "@beep/workspace-tables/entities"
 *
 * const tableName = CandidateDraft.TABLE_NAME
 * console.log(tableName)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const Table = toPgTable(CandidateDraft);

/**
 * Physical Postgres table name derived from the CandidateDraft entity.
 *
 * **Example** (Read the table name)
 *
 * ```ts
 * import { TABLE_NAME } from "@beep/workspace-tables/entities/CandidateDraft"
 *
 * console.log(TABLE_NAME)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const TABLE_NAME = getTableName(Table);
