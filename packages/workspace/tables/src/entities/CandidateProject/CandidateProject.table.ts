/**
 * Workspace CandidateProject table metadata.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { EntityTable } from "@beep/drizzle";
import { CandidateProject } from "@beep/workspace-domain/entities/CandidateProject";

/**
 * PGLite/Postgres Drizzle table for the workspace CandidateProject entity.
 *
 * **Example** (Read table name and lifecycle)
 *
 * ```ts
 * import { CandidateProject } from "@beep/workspace-tables/entities"
 *
 * const tableName: "workspace_candidate_project" = CandidateProject.Table.definition.tableName
 * const lifecycleStorage: "literal" = CandidateProject.Table.definition.persisted.lifecycle.storageKind
 *
 * console.log(`${tableName}:${lifecycleStorage}`)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const Table = EntityTable.pgTableFrom(CandidateProject);
