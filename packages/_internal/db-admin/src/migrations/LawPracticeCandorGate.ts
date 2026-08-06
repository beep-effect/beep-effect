/**
 * Law-practice candor-gate db-admin migration target.
 *
 * @packageDocumentation
 * @category configuration
 * @since 0.0.0
 */

import { DbSchema as LawPracticeDbSchema } from "@beep/law-practice-tables";
import { DbAdminMigrationTarget } from "./ArchitectureLab.ts";

/**
 * The law-practice slice's first migration target: the three append-only tables
 * behind the patent citation candor gate.
 *
 * **Example** (Inspect the target name and its tables)
 *
 * ```ts
 * import { LawPracticeCandorGateMigrationTarget } from "@beep/db-admin/targets"
 *
 * console.log(LawPracticeCandorGateMigrationTarget.name)
 * // "law-practice-candor-gate"
 * console.log(LawPracticeCandorGateMigrationTarget.tables.length)
 * // 3
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const LawPracticeCandorGateMigrationTarget: DbAdminMigrationTarget = DbAdminMigrationTarget.make({
  drizzleSchema: {
    candorDisposition: LawPracticeDbSchema.candorDisposition,
    idsSubmissionFact: LawPracticeDbSchema.idsSubmissionFact,
    patentCitationEvent: LawPracticeDbSchema.patentCitationEvent,
  },
  name: "law-practice-candor-gate",
  schemaName: "law_practice",
  tables: ["law_practice_patent_citation_event", "law_practice_candor_disposition", "law_practice_ids_submission_fact"],
});
