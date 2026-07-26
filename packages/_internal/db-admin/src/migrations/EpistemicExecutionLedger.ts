/**
 * Epistemic execution ledger db-admin migration target.
 *
 * @packageDocumentation
 * @category configuration
 * @since 0.0.0
 */

import { DbSchema as EpistemicDbSchema } from "@beep/epistemic-tables";
import {
  EXECUTION_DECISION_TABLE_NAME,
  EXECUTION_OUTCOME_TABLE_NAME,
} from "@beep/epistemic-tables/values/ExecutionRecord";
import { DbAdminMigrationTarget } from "./ArchitectureLab.ts";

/**
 * Epistemic execution ledger migration target used to prove the write-ahead
 * decision chain and post-settlement outcome persistence.
 *
 * The append-only invariants these tables rely on — the chain primary key, the
 * outcome-per-decision primary key, the composite decision foreign key, the
 * reason-iff-denied CHECK, and the `BEFORE UPDATE`/`BEFORE DELETE` triggers —
 * are owned by the raw-SQL migration rather than by Drizzle metadata, so this
 * target publishes the table set while the migration publishes the invariants.
 *
 * @example
 * ```ts
 * import { EpistemicExecutionLedgerMigrationTarget } from "@beep/db-admin/migrations/EpistemicExecutionLedger"
 *
 * console.log(EpistemicExecutionLedgerMigrationTarget.tables)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const EpistemicExecutionLedgerMigrationTarget: DbAdminMigrationTarget = DbAdminMigrationTarget.make({
  name: "epistemic-execution-ledger",
  schemaName: "epistemic",
  tables: [EXECUTION_DECISION_TABLE_NAME, EXECUTION_OUTCOME_TABLE_NAME],
  drizzleSchema: {
    executionDecision: EpistemicDbSchema.executionDecision,
    executionOutcome: EpistemicDbSchema.executionOutcome,
  },
});
