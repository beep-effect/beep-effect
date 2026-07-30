/**
 * Epistemic contradiction-triage db-admin migration target.
 *
 * @packageDocumentation
 * @category configuration
 * @since 0.0.0
 */

import { DbSchema as EpistemicDbSchema } from "@beep/epistemic-tables";
import { DbAdminMigrationTarget } from "./ArchitectureLab.ts";

/**
 * Additive contradiction-triage and evidence-verification table target.
 *
 * @example
 * ```ts
 * import { EpistemicContradictionTriageMigrationTarget } from "@beep/db-admin/targets"
 *
 * console.log(EpistemicContradictionTriageMigrationTarget.name)
 * // "epistemic-contradiction-triage"
 * console.log(EpistemicContradictionTriageMigrationTarget.tables.length)
 * // 4
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const EpistemicContradictionTriageMigrationTarget: DbAdminMigrationTarget = DbAdminMigrationTarget.make({
  drizzleSchema: {
    contradictionCandidate: EpistemicDbSchema.contradictionCandidate,
    contradictionDisposition: EpistemicDbSchema.contradictionDisposition,
    contradictionReceipt: EpistemicDbSchema.contradictionReceipt,
    evidenceVerification: EpistemicDbSchema.evidenceVerification,
  },
  name: "epistemic-contradiction-triage",
  schemaName: "epistemic",
  tables: [
    "epistemic_contradiction_candidate",
    "epistemic_contradiction_receipt",
    "epistemic_contradiction_disposition",
    "epistemic_evidence_verification",
  ],
});
