/**
 * Epistemic Drizzle schema aggregate.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { CandidateClaim, ClaimDisposition, EdgeVersion, Evidence, UsageRecord } from "./entities/index.ts";

type DbSchemaShape = {
  readonly candidateClaim: typeof CandidateClaim.Table;
  readonly claimDisposition: typeof ClaimDisposition.Table;
  readonly edgeVersion: typeof EdgeVersion.Table;
  readonly evidence: typeof Evidence.Table;
  readonly usageRecord: typeof UsageRecord.Table;
};

/**
 * Metadata-only epistemic Drizzle schema aggregate.
 *
 * @example
 * ```ts
 * import { DbSchema } from "@beep/epistemic-tables"
 *
 * console.log(DbSchema.usageRecord.definition.tableName)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const DbSchema: DbSchemaShape = {
  candidateClaim: CandidateClaim.Table,
  claimDisposition: ClaimDisposition.Table,
  edgeVersion: EdgeVersion.Table,
  evidence: Evidence.Table,
  usageRecord: UsageRecord.Table,
};

/**
 * Type for {@link DbSchema}.
 *
 * @example
 * ```ts
 * import { DbSchema } from "@beep/epistemic-tables"
 * import type { DbSchema as DbSchemaShape } from "@beep/epistemic-tables"
 *
 * const schema = DbSchema satisfies DbSchemaShape
 * console.log(schema.edgeVersion.definition.tableName)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export type DbSchema = DbSchemaShape;
