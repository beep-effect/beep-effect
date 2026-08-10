/**
 * Law-practice legal-position db-admin migration target.
 *
 * @packageDocumentation
 * @category configuration
 * @since 0.0.0
 */

import { DbSchema as LawPracticeDbSchema } from "@beep/law-practice-tables";
import { DbAdminMigrationTarget } from "./ArchitectureLab.ts";

/**
 * The law-practice slice's second migration target: the five append-only tables
 * behind the legal position relator runtime.
 *
 * **Details**
 *
 * This target is a delta against the candor-gate migration rather than a
 * bootstrap — the slice's schema already sits in the baseline snapshot chain, so
 * generation emits only these five `CREATE TABLE` statements and leaves every
 * candor object untouched.
 *
 * **Example** (Inspect the target name and its tables)
 *
 * ```ts
 * import { LawPracticeLegalPositionMigrationTarget } from "@beep/db-admin/targets"
 *
 * console.log(LawPracticeLegalPositionMigrationTarget.name)
 * // "law-practice-legal-position"
 * console.log(LawPracticeLegalPositionMigrationTarget.tables.length)
 * // 5
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const LawPracticeLegalPositionMigrationTarget: DbAdminMigrationTarget = DbAdminMigrationTarget.make({
  drizzleSchema: {
    actFrame: LawPracticeDbSchema.actFrame,
    correctionDelta: LawPracticeDbSchema.correctionDelta,
    legalOppositionCandidate: LawPracticeDbSchema.legalOppositionCandidate,
    legalPositionRelator: LawPracticeDbSchema.legalPositionRelator,
    powerExercise: LawPracticeDbSchema.powerExercise,
  },
  name: "law-practice-legal-position",
  schemaName: "law_practice",
  tables: [
    "law_practice_legal_position_relator",
    "law_practice_act_frame",
    "law_practice_power_exercise",
    "law_practice_correction_delta",
    "law_practice_legal_opposition_candidate",
  ],
});
