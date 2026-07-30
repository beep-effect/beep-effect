/**
 * db-admin Drizzle schema barrel — the `drizzle-kit generate` surface.
 *
 * drizzle-kit's export scanner only inspects top-level exports for pgTable
 * values, so every table that participates in migration generation MUST be
 * re-exported flat here; exporting a table from this file is what schedules
 * its migrations. The `DbSchema` aggregates are re-exported for consumers that
 * want the grouped shape, but drizzle-kit cannot see through them.
 *
 * `workspace_candidate_draft` / `workspace_candidate_project` are deliberately
 * NOT exported: they have no deployed table, and baking them into the baseline
 * snapshot would suppress their eventual CREATE migration.
 *
 * @packageDocumentation
 * @category configuration
 * @since 0.0.0
 */

import { DbSchema as ArchitectureLabDbSchema } from "@beep/architecture-lab-tables/tables";
import { DbSchema as DocumentsDbSchema } from "@beep/documents-tables/tables";
import { DbSchema as EpistemicDbSchema } from "@beep/epistemic-tables";
import { DbSchema as WorkspaceDbSchema } from "@beep/workspace-tables";

/**
 * Architecture lab Drizzle schema export.
 *
 * @category configuration
 * @since 0.0.0
 */
/**
 * Documents Drizzle schema export.
 *
 * @category configuration
 * @since 0.0.0
 */
/**
 * Epistemic Drizzle schema export.
 *
 * @category configuration
 * @since 0.0.0
 */
/**
 * Workspace Drizzle schema export.
 *
 * @category configuration
 * @since 0.0.0
 */
export { ArchitectureLabDbSchema, DocumentsDbSchema, EpistemicDbSchema, WorkspaceDbSchema };

/**
 * Architecture lab work item table (drizzle-kit generate surface).
 *
 * @example
 * ```ts
 * import { architectureLabWorkItemTable } from "@beep/db-admin/schema"
 *
 * console.log(architectureLabWorkItemTable)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const architectureLabWorkItemTable: typeof ArchitectureLabDbSchema.workItem = ArchitectureLabDbSchema.workItem;

/**
 * Architecture lab worker table (drizzle-kit generate surface).
 *
 * @example
 * ```ts
 * import { architectureLabWorkerTable } from "@beep/db-admin/schema"
 *
 * console.log(architectureLabWorkerTable)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const architectureLabWorkerTable: typeof ArchitectureLabDbSchema.worker = ArchitectureLabDbSchema.worker;

/**
 * Workspace workspace table (drizzle-kit generate surface).
 *
 * @example
 * ```ts
 * import { workspaceWorkspaceTable } from "@beep/db-admin/schema"
 *
 * console.log(workspaceWorkspaceTable)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const workspaceWorkspaceTable: typeof WorkspaceDbSchema.workspace = WorkspaceDbSchema.workspace;

/**
 * Workspace thread table (drizzle-kit generate surface).
 *
 * @example
 * ```ts
 * import { workspaceThreadTable } from "@beep/db-admin/schema"
 *
 * console.log(workspaceThreadTable)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const workspaceThreadTable: typeof WorkspaceDbSchema.thread = WorkspaceDbSchema.thread;

/**
 * Workspace turn table (drizzle-kit generate surface).
 *
 * @example
 * ```ts
 * import { workspaceTurnTable } from "@beep/db-admin/schema"
 *
 * console.log(workspaceTurnTable)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const workspaceTurnTable: typeof WorkspaceDbSchema.turn = WorkspaceDbSchema.turn;

/**
 * Workspace message table (drizzle-kit generate surface).
 *
 * @example
 * ```ts
 * import { workspaceMessageTable } from "@beep/db-admin/schema"
 *
 * console.log(workspaceMessageTable)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const workspaceMessageTable: typeof WorkspaceDbSchema.message = WorkspaceDbSchema.message;

/**
 * Epistemic usage record table (drizzle-kit generate surface).
 *
 * @example
 * ```ts
 * import { epistemicUsageRecordTable } from "@beep/db-admin/schema"
 *
 * console.log(epistemicUsageRecordTable)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const epistemicUsageRecordTable: typeof EpistemicDbSchema.usageRecord = EpistemicDbSchema.usageRecord;

/**
 * Epistemic contradiction candidate table (drizzle-kit generate surface).
 *
 * @example
 * ```ts
 * import { epistemicContradictionCandidateTable } from "@beep/db-admin/schema"
 *
 * console.log(epistemicContradictionCandidateTable.definition.tableName)
 * // "epistemic_contradiction_candidate"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const epistemicContradictionCandidateTable: typeof EpistemicDbSchema.contradictionCandidate =
  EpistemicDbSchema.contradictionCandidate;

/**
 * Epistemic contradiction receipt table (drizzle-kit generate surface).
 *
 * @example
 * ```ts
 * import { epistemicContradictionReceiptTable } from "@beep/db-admin/schema"
 *
 * console.log(epistemicContradictionReceiptTable.definition.tableName)
 * // "epistemic_contradiction_receipt"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const epistemicContradictionReceiptTable: typeof EpistemicDbSchema.contradictionReceipt =
  EpistemicDbSchema.contradictionReceipt;

/**
 * Epistemic contradiction disposition table (drizzle-kit generate surface).
 *
 * @example
 * ```ts
 * import { epistemicContradictionDispositionTable } from "@beep/db-admin/schema"
 *
 * console.log(epistemicContradictionDispositionTable.definition.tableName)
 * // "epistemic_contradiction_disposition"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const epistemicContradictionDispositionTable: typeof EpistemicDbSchema.contradictionDisposition =
  EpistemicDbSchema.contradictionDisposition;

/**
 * Epistemic evidence-verification table (drizzle-kit generate surface).
 *
 * @example
 * ```ts
 * import { epistemicEvidenceVerificationTable } from "@beep/db-admin/schema"
 *
 * console.log(epistemicEvidenceVerificationTable.definition.tableName)
 * // "epistemic_evidence_verification"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const epistemicEvidenceVerificationTable: typeof EpistemicDbSchema.evidenceVerification =
  EpistemicDbSchema.evidenceVerification;

/**
 * Documents sync item table (drizzle-kit generate surface).
 *
 * @example
 * ```ts
 * import { documentsSyncItemTable } from "@beep/db-admin/schema"
 *
 * console.log(documentsSyncItemTable)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const documentsSyncItemTable: typeof DocumentsDbSchema.syncItem = DocumentsDbSchema.syncItem;

/**
 * Documents sync operation table (drizzle-kit generate surface).
 *
 * @example
 * ```ts
 * import { documentsSyncOperationTable } from "@beep/db-admin/schema"
 *
 * console.log(documentsSyncOperationTable)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const documentsSyncOperationTable: typeof DocumentsDbSchema.syncOperation = DocumentsDbSchema.syncOperation;

/**
 * Documents sync cursor table (drizzle-kit generate surface).
 *
 * @example
 * ```ts
 * import { documentsSyncCursorTable } from "@beep/db-admin/schema"
 *
 * console.log(documentsSyncCursorTable)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const documentsSyncCursorTable: typeof DocumentsDbSchema.syncCursor = DocumentsDbSchema.syncCursor;

/**
 * Documents sync conflict table (drizzle-kit generate surface).
 *
 * @example
 * ```ts
 * import { documentsSyncConflictTable } from "@beep/db-admin/schema"
 *
 * console.log(documentsSyncConflictTable)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const documentsSyncConflictTable: typeof DocumentsDbSchema.syncConflict = DocumentsDbSchema.syncConflict;
