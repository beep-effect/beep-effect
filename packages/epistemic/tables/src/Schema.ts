/**
 * Epistemic Drizzle schema aggregate.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import {
  CandidateClaim,
  ClaimDisposition,
  Contradiction,
  EdgeVersion,
  Evidence,
  EvidenceVerification,
  UsageRecord,
} from "./entities/index.ts";
import { ExecutionRecord } from "./values/index.ts";

type DbSchemaShape = {
  readonly candidateClaim: typeof CandidateClaim.Table;
  readonly claimDisposition: typeof ClaimDisposition.Table;
  readonly contradictionCandidate: typeof Contradiction.candidateTable;
  readonly contradictionDisposition: typeof Contradiction.dispositionTable;
  readonly contradictionReceipt: typeof Contradiction.receiptTable;
  readonly edgeVersion: typeof EdgeVersion.Table;
  readonly evidence: typeof Evidence.Table;
  readonly evidenceVerification: typeof EvidenceVerification.Table;
  readonly executionDecision: typeof ExecutionRecord.executionDecisionTable;
  readonly executionOutcome: typeof ExecutionRecord.executionOutcomeTable;
  readonly usageRecord: typeof UsageRecord.Table;
};

/**
 * Metadata-only epistemic Drizzle schema aggregate.
 *
 * **Example** (Log usageRecord table name)
 *
 * ```ts
 * import { DbSchema } from "@beep/epistemic-tables"
 *
 * import { getTableName } from "drizzle-orm"
 *
 * console.log(getTableName(DbSchema.usageRecord))
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const DbSchema: DbSchemaShape = {
  candidateClaim: CandidateClaim.Table,
  claimDisposition: ClaimDisposition.Table,
  contradictionCandidate: Contradiction.candidateTable,
  contradictionDisposition: Contradiction.dispositionTable,
  contradictionReceipt: Contradiction.receiptTable,
  edgeVersion: EdgeVersion.Table,
  evidence: Evidence.Table,
  evidenceVerification: EvidenceVerification.Table,
  executionDecision: ExecutionRecord.executionDecisionTable,
  executionOutcome: ExecutionRecord.executionOutcomeTable,
  usageRecord: UsageRecord.Table,
};

/**
 * Type for {@link DbSchema}.
 *
 * **Example** (Satisfy DbSchema type shape)
 *
 * ```ts
 * import { DbSchema } from "@beep/epistemic-tables"
 * import type { DbSchema as DbSchemaShape } from "@beep/epistemic-tables"
 * import { getTableName } from "drizzle-orm"
 *
 * const schema = DbSchema satisfies DbSchemaShape
 * console.log(getTableName(schema.edgeVersion))
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export type DbSchema = DbSchemaShape;
