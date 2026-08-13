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
 * const tableName: "workspace_candidate_draft" = CandidateDraft.TABLE_NAME
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
 * @category tables
 * @since 0.0.0
 */
export const TABLE_NAME = getTableName(Table);
