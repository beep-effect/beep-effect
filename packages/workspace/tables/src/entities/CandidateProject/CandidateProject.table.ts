/**
 * Workspace CandidateProject table metadata.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { toPgTable } from "@beep/effect-drizzle/pg";
import { CandidateProject } from "@beep/workspace-domain/entities/CandidateProject";
import { getTableName } from "drizzle-orm";

/**
 * PGLite/Postgres Drizzle table for the workspace CandidateProject entity.
 *
 * **Example** (Read table name and lifecycle)
 *
 * ```ts
 * import { CandidateProject } from "@beep/workspace-tables/entities"
 *
 * const tableName: "workspace_candidate_project" = CandidateProject.TABLE_NAME
 * console.log(tableName)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const Table = toPgTable(CandidateProject);

/**
 * Physical Postgres table name derived from the CandidateProject entity.
 *
 * @category tables
 * @since 0.0.0
 */
export const TABLE_NAME = getTableName(Table);
