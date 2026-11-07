/**
 * Drizzle schema aggregate for the execution authority slice.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { ExecutionRecord } from "./entities/index.ts";

type DbSchemaShape = {
  readonly executionDecision: typeof ExecutionRecord.executionDecisionTable;
  readonly executionOutcome: typeof ExecutionRecord.executionOutcomeTable;
};

/**
 * Every execution authority table, keyed for composition into a database schema.
 *
 * **Example** (Read the outcome table from the aggregate)
 *
 * ```ts
 * import { DbSchema } from "@beep/execution-authority-tables"
 * import { getTableName } from "drizzle-orm"
 *
 * console.log(getTableName(DbSchema.executionOutcome))
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const DbSchema: DbSchemaShape = {
  executionDecision: ExecutionRecord.executionDecisionTable,
  executionOutcome: ExecutionRecord.executionOutcomeTable,
};

/**
 * Type of the execution authority schema aggregate.
 *
 * @category tables
 * @since 0.0.0
 */
export type DbSchema = DbSchemaShape;
