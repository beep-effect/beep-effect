/**
 * Execution authority ledger db-admin migration target.
 *
 * @packageDocumentation
 * @category configuration
 * @since 0.0.0
 */

import { DbSchema as ExecutionAuthorityDbSchema } from "@beep/execution-authority-tables";
import {
  EXECUTION_DECISION_TABLE_NAME,
  EXECUTION_OUTCOME_TABLE_NAME,
} from "@beep/execution-authority-tables/entities/ExecutionRecord";
import { DbAdminMigrationTarget } from "./ArchitectureLab.ts";

/**
 * Execution authority ledger migration target used to prove the write-ahead
 * decision chain and post-settlement outcome persistence.
 *
 * **Details**
 *
 * The append-only invariants these tables rely on — the chain primary key, the
 * outcome-per-decision primary key, the composite decision foreign key, the
 * reason-iff-denied CHECK, and the `BEFORE UPDATE`/`BEFORE DELETE` triggers —
 * are owned by the raw-SQL migration rather than by Drizzle metadata, so this
 * target publishes the table set while the migration publishes the invariants.
 *
 * **Example** (Log migration target tables)
 *
 * ```ts
 * import { ExecutionAuthorityLedgerMigrationTarget } from "@beep/db-admin/migrations/ExecutionAuthorityLedger"
 *
 * console.log(ExecutionAuthorityLedgerMigrationTarget.tables)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const ExecutionAuthorityLedgerMigrationTarget: DbAdminMigrationTarget = DbAdminMigrationTarget.make({
  name: "execution-authority-ledger",
  schemaName: "execution_authority",
  tables: [EXECUTION_DECISION_TABLE_NAME, EXECUTION_OUTCOME_TABLE_NAME],
  drizzleSchema: {
    executionDecision: ExecutionAuthorityDbSchema.executionDecision,
    executionOutcome: ExecutionAuthorityDbSchema.executionOutcome,
  },
});
