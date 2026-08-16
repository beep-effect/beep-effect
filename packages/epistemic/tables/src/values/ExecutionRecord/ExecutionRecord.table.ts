/**
 * Execution ledger table metadata: the write-ahead decision chain and the
 * post-settlement outcome records.
 *
 * These are deliberately raw `pgTable` declarations, not ProductEntity
 * projections: the product kit includes `row_version`, `updated_at`,
 * and `updated_by_principal` — update vocabulary that would be a lie in the
 * schema of rows that must never mutate. The append-only guards that make the
 * ledger trustworthy — the chain primary key, the outcome-per-decision primary
 * key, the reason-iff-denied CHECK, and the `BEFORE UPDATE`/`BEFORE DELETE`
 * triggers — are owned by the raw-SQL migration rather than by Drizzle
 * metadata, because Drizzle cannot express them. This projection publishes the
 * columns; the migration publishes the invariants.
 *
 * There is deliberately no column here capable of carrying a payload: every
 * text column is a digest, a bounded literal, or a pinned semver, and the
 * absence of `jsonb` is asserted by test, not comment.
 *
 * @packageDocumentation
 * @category tables
 * @since 0.0.0
 */

import { bigint, integer, pgTable, text } from "drizzle-orm/pg-core";
import type { SinkAudience, SinkClass } from "@beep/epistemic-domain/values/ExecutionGrant";
import type { ExecutionSettlement } from "@beep/epistemic-domain/values/ExecutionRecord";
import type { DenialReason } from "@beep/epistemic-domain/values/ExecutionVerdict";

/**
 * Physical Postgres table name for write-ahead execution decisions.
 *
 * **Example** (Log decision table name)
 *
 * ```ts
 * import { EXECUTION_DECISION_TABLE_NAME } from "@beep/epistemic-tables/values/ExecutionRecord"
 *
 * console.log(EXECUTION_DECISION_TABLE_NAME) // "epistemic_execution_decision"
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const EXECUTION_DECISION_TABLE_NAME = "epistemic_execution_decision" as const;

/**
 * Physical Postgres table name for post-settlement execution outcomes.
 *
 * **Example** (Log outcome table name)
 *
 * ```ts
 * import { EXECUTION_OUTCOME_TABLE_NAME } from "@beep/epistemic-tables/values/ExecutionRecord"
 *
 * console.log(EXECUTION_OUTCOME_TABLE_NAME) // "epistemic_execution_outcome"
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const EXECUTION_OUTCOME_TABLE_NAME = "epistemic_execution_outcome" as const;

/**
 * Drizzle projection of the write-ahead execution decision chain.
 *
 * **Details**
 *
 * The natural key is `(run_key, seq)` — there is no surrogate id, because a
 * surrogate would add nothing the chain does not already pin. `prev_hash` is
 * null only at `seq` zero; the migration's `genesis_prev` CHECK makes that
 * shape unrepresentable otherwise.
 *
 * **Example** (Get decision table name)
 *
 * ```ts
 * import { getTableName } from "drizzle-orm"
 * import { executionDecisionTable } from "@beep/epistemic-tables/values/ExecutionRecord"
 *
 * console.log(getTableName(executionDecisionTable)) // "epistemic_execution_decision"
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const executionDecisionTable = pgTable(EXECUTION_DECISION_TABLE_NAME, {
  runKey: text("run_key").notNull(),
  seq: integer("seq").notNull(),
  prevHash: text("prev_hash"),
  hash: text("hash").notNull(),
  verdict: text("verdict").notNull().$type<"allowed" | "denied">(),
  reason: text("reason").$type<DenialReason>(),
  operationDigest: text("operation_digest").notNull(),
  sinkClass: text("sink_class").notNull().$type<SinkClass>(),
  audience: text("audience").notNull().$type<SinkAudience>(),
  destinationDigest: text("destination_digest").notNull(),
  grantSetDigest: text("grant_set_digest").notNull(),
  policyRevision: text("policy_revision").notNull(),
  decidedAt: bigint("decided_at", { mode: "number" }).notNull(),
});

/**
 * Drizzle projection of the post-settlement execution outcome records.
 *
 * **Details**
 *
 * `decision_hash` is the primary key, so one outcome per decision is a table
 * shape rather than a convention, and the composite foreign key to
 * `(run_key, hash)` makes an outcome without its write-ahead decision
 * unrepresentable.
 *
 * `decision_verdict` is defaulted to `'allowed'`, CHECK-pinned to that literal,
 * and bound by a second composite foreign key to the decision's
 * `(hash, verdict)` — which makes an outcome settling a DENIED decision
 * unrepresentable too. The column never varies and is filled by the database
 * default, but remains in the Drizzle projection so a generated baseline owns
 * the complete physical column order.
 *
 * **Example** (Get outcome table name)
 *
 * ```ts
 * import { getTableName } from "drizzle-orm"
 * import { executionOutcomeTable } from "@beep/epistemic-tables/values/ExecutionRecord"
 *
 * console.log(getTableName(executionOutcomeTable)) // "epistemic_execution_outcome"
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const executionOutcomeTable = pgTable(EXECUTION_OUTCOME_TABLE_NAME, {
  runKey: text("run_key").notNull(),
  decisionHash: text("decision_hash").notNull().primaryKey(),
  decisionVerdict: text("decision_verdict").notNull().default("allowed").$type<"allowed">(),
  settlement: text("settlement").notNull().$type<ExecutionSettlement>(),
  recordedAt: bigint("recorded_at", { mode: "number" }).notNull(),
  hash: text("hash").notNull(),
});
