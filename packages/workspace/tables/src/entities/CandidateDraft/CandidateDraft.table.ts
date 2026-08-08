/**
 * Workspace CandidateDraft table metadata.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { EntityTable } from "@beep/drizzle";
import { CandidateDraft } from "@beep/workspace-domain/entities/CandidateDraft";

/**
 * PGLite/Postgres Drizzle table for the workspace CandidateDraft entity.
 *
 * **Example** (Read CandidateDraft table metadata)
 *
 * ```ts
 * import { CandidateDraft } from "@beep/workspace-tables/entities"
 *
 * const tableName: "workspace_candidate_draft" = CandidateDraft.Table.definition.tableName
 * const snapshotStorage: "jsonb" = CandidateDraft.Table.definition.persisted.snapshot.storageKind
 *
 * console.log(`${tableName}:${snapshotStorage}`)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const Table = EntityTable.pgTableFrom(CandidateDraft);
