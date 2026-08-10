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
import { DbSchema as LawPracticeDbSchema } from "@beep/law-practice-tables";
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
 * **Example** (Reference the architecture lab work item table)
 *
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
 * **Example** (Reference the architecture lab worker table)
 *
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
 * **Example** (Reference the workspace table)
 *
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
 * **Example** (Reference the workspace thread table)
 *
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
 * **Example** (Reference the workspace turn table)
 *
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
 * **Example** (Reference the workspace message table)
 *
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
 * **Example** (Reference the epistemic usage record table)
 *
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
 * **Example** (Read the contradiction candidate table name)
 *
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
 * **Example** (Read the contradiction receipt table name)
 *
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
 * **Example** (Read the contradiction disposition table name)
 *
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
 * **Example** (Read the evidence verification table name)
 *
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
 * **Example** (Reference the documents sync item table)
 *
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
 * **Example** (Reference the documents sync operation table)
 *
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
 * **Example** (Reference the documents sync cursor table)
 *
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
 * **Example** (Reference the documents sync conflict table)
 *
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

/**
 * Law-practice patent citation event table (drizzle-kit generate surface).
 *
 * **Example** (Read the patent citation event table name)
 *
 * ```ts
 * import { lawPracticePatentCitationEventTable } from "@beep/db-admin/schema"
 *
 * console.log(lawPracticePatentCitationEventTable.definition.tableName)
 * // "law_practice_patent_citation_event"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const lawPracticePatentCitationEventTable: typeof LawPracticeDbSchema.patentCitationEvent =
  LawPracticeDbSchema.patentCitationEvent;

/**
 * Law-practice candor disposition table (drizzle-kit generate surface).
 *
 * **Example** (Read the candor disposition table name)
 *
 * ```ts
 * import { lawPracticeCandorDispositionTable } from "@beep/db-admin/schema"
 *
 * console.log(lawPracticeCandorDispositionTable.definition.tableName)
 * // "law_practice_candor_disposition"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const lawPracticeCandorDispositionTable: typeof LawPracticeDbSchema.candorDisposition =
  LawPracticeDbSchema.candorDisposition;

/**
 * Law-practice information-disclosure submission fact table (drizzle-kit generate surface).
 *
 * **Example** (Read the IDS submission fact table name)
 *
 * ```ts
 * import { lawPracticeIdsSubmissionFactTable } from "@beep/db-admin/schema"
 *
 * console.log(lawPracticeIdsSubmissionFactTable.definition.tableName)
 * // "law_practice_ids_submission_fact"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const lawPracticeIdsSubmissionFactTable: typeof LawPracticeDbSchema.idsSubmissionFact =
  LawPracticeDbSchema.idsSubmissionFact;

/**
 * Law-practice legal position relator table (drizzle-kit generate surface).
 *
 * **Example** (Read the legal position relator table name)
 *
 * ```ts
 * import { lawPracticeLegalPositionRelatorTable } from "@beep/db-admin/schema"
 *
 * console.log(lawPracticeLegalPositionRelatorTable.definition.tableName)
 * // "law_practice_legal_position_relator"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const lawPracticeLegalPositionRelatorTable: typeof LawPracticeDbSchema.legalPositionRelator =
  LawPracticeDbSchema.legalPositionRelator;

/**
 * Law-practice act frame table (drizzle-kit generate surface).
 *
 * **Example** (Read the act frame table name)
 *
 * ```ts
 * import { lawPracticeActFrameTable } from "@beep/db-admin/schema"
 *
 * console.log(lawPracticeActFrameTable.definition.tableName)
 * // "law_practice_act_frame"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const lawPracticeActFrameTable: typeof LawPracticeDbSchema.actFrame = LawPracticeDbSchema.actFrame;

/**
 * Law-practice power exercise table (drizzle-kit generate surface).
 *
 * **Example** (Read the power exercise table name)
 *
 * ```ts
 * import { lawPracticePowerExerciseTable } from "@beep/db-admin/schema"
 *
 * console.log(lawPracticePowerExerciseTable.definition.tableName)
 * // "law_practice_power_exercise"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const lawPracticePowerExerciseTable: typeof LawPracticeDbSchema.powerExercise =
  LawPracticeDbSchema.powerExercise;

/**
 * Law-practice correction delta table (drizzle-kit generate surface).
 *
 * **Example** (Read the correction delta table name)
 *
 * ```ts
 * import { lawPracticeCorrectionDeltaTable } from "@beep/db-admin/schema"
 *
 * console.log(lawPracticeCorrectionDeltaTable.definition.tableName)
 * // "law_practice_correction_delta"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const lawPracticeCorrectionDeltaTable: typeof LawPracticeDbSchema.correctionDelta =
  LawPracticeDbSchema.correctionDelta;

/**
 * Law-practice legal opposition candidate table (drizzle-kit generate surface).
 *
 * **Example** (Read the legal opposition candidate table name)
 *
 * ```ts
 * import { lawPracticeLegalOppositionCandidateTable } from "@beep/db-admin/schema"
 *
 * console.log(lawPracticeLegalOppositionCandidateTable.definition.tableName)
 * // "law_practice_legal_opposition_candidate"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const lawPracticeLegalOppositionCandidateTable: typeof LawPracticeDbSchema.legalOppositionCandidate =
  LawPracticeDbSchema.legalOppositionCandidate;
