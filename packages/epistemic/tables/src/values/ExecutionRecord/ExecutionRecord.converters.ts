/**
 * Execution ledger row conversions.
 *
 * The PR 1 record schemas are their own row codecs: their encoded form is
 * already the flat wire projection these tables persist — digests as hex
 * strings, instants as epoch millis, `prevHash` as `null` at genesis — so the
 * converters are `S.encode`/`S.decode` at the boundary and nothing else. The
 * only asymmetry is `reason`: the column exists on every decision row (`null`
 * for allowed), while the domain union carries the field only on the denied
 * variant, so the null is stripped before decoding. The reason-shape invariant
 * itself (present iff denied) is owned by the migration's CHECK constraints,
 * not re-guarded here.
 *
 * @packageDocumentation
 * @category tables
 * @since 0.0.0
 */

import { ExecutionDecisionRecord, ExecutionOutcomeRecord } from "@beep/epistemic-domain/values/ExecutionRecord";
import * as S from "effect/Schema";
import type { executionDecisionTable, executionOutcomeTable } from "./ExecutionRecord.table.ts";

/**
 * Row type selected from {@link executionDecisionTable}.
 *
 * **Example** (Access seq from decision row)
 *
 * ```ts
 * import type { ExecutionDecisionRow } from "@beep/epistemic-tables/values/ExecutionRecord"
 *
 * const seqOf = (row: ExecutionDecisionRow): number => row.seq
 * console.log(seqOf.length) // 1
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export type ExecutionDecisionRow = typeof executionDecisionTable.$inferSelect;

/**
 * Insert row type for {@link executionDecisionTable}.
 *
 * **Example** (Access hash from decision insert)
 *
 * ```ts
 * import type { ExecutionDecisionInsert } from "@beep/epistemic-tables/values/ExecutionRecord"
 *
 * const hashOf = (insert: ExecutionDecisionInsert): string => insert.hash
 * console.log(hashOf.length) // 1
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export type ExecutionDecisionInsert = typeof executionDecisionTable.$inferInsert;

/**
 * Row type selected from {@link executionOutcomeTable}.
 *
 * **Example** (Access settlement from outcome row)
 *
 * ```ts
 * import type { ExecutionOutcomeRow } from "@beep/epistemic-tables/values/ExecutionRecord"
 *
 * const settlementOf = (row: ExecutionOutcomeRow): string => row.settlement
 * console.log(settlementOf.length) // 1
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export type ExecutionOutcomeRow = typeof executionOutcomeTable.$inferSelect;

/**
 * Insert row type for {@link executionOutcomeTable}.
 *
 * **Example** (Access hash from outcome insert)
 *
 * ```ts
 * import type { ExecutionOutcomeInsert } from "@beep/epistemic-tables/values/ExecutionRecord"
 *
 * const hashOf = (insert: ExecutionOutcomeInsert): string => insert.hash
 * console.log(hashOf.length) // 1
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export type ExecutionOutcomeInsert = typeof executionOutcomeTable.$inferInsert;

const encodeExecutionDecision = S.encodeSync(ExecutionDecisionRecord);
const decodeExecutionDecisionRow = S.decodeUnknownSync(ExecutionDecisionRecord);
const encodeExecutionOutcome = S.encodeSync(ExecutionOutcomeRecord);
const decodeExecutionOutcomeRow = S.decodeUnknownSync(ExecutionOutcomeRecord);

/**
 * Project a sealed decision record onto its insert row.
 *
 * **Example** (Project sealed decision to insert)
 *
 * ```ts
 * import { ExecutionDecisionRecord } from "@beep/epistemic-domain/values/ExecutionRecord"
 * import { toExecutionDecisionInsert } from "@beep/epistemic-tables/values/ExecutionRecord"
 * import * as S from "effect/Schema"
 *
 * const digest = "a".repeat(64)
 * const record = S.decodeUnknownSync(ExecutionDecisionRecord)({
 *   audience: "external-network",
 *   decidedAt: 0,
 *   destinationDigest: digest,
 *   grantSetDigest: digest,
 *   hash: digest,
 *   operationDigest: digest,
 *   policyRevision: "1.0.0",
 *   prevHash: null,
 *   runKey: digest,
 *   seq: 0,
 *   sinkClass: "network-egress",
 *   verdict: "allowed"
 * })
 *
 * console.log(toExecutionDecisionInsert(record).seq) // 0
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const toExecutionDecisionInsert = (record: ExecutionDecisionRecord): ExecutionDecisionInsert =>
  encodeExecutionDecision(record);

/**
 * Decode a decision row back into the domain record.
 *
 * **Details**
 *
 * A `null` reason is the column's shape for the allowed variant, not domain
 * data, so it is stripped before decoding. A non-null reason on an allowed row
 * is NOT guarded here — union decoding drops the excess key silently — because
 * the migration's `reason_iff_denied` CHECK makes such a row unrepresentable at
 * the table; the database owns that invariant, not this converter.
 *
 * **Example** (Check fromExecutionDecisionRow type)
 *
 * ```ts
 * import { fromExecutionDecisionRow } from "@beep/epistemic-tables/values/ExecutionRecord"
 *
 * console.log(typeof fromExecutionDecisionRow) // "function"
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const fromExecutionDecisionRow = (row: ExecutionDecisionRow): ExecutionDecisionRecord => {
  const { reason, ...allowedShape } = row;
  return decodeExecutionDecisionRow(reason === null ? allowedShape : row);
};

/**
 * Project a sealed outcome record onto its insert row.
 *
 * **Example** (Check toExecutionOutcomeInsert type)
 *
 * ```ts
 * import { toExecutionOutcomeInsert } from "@beep/epistemic-tables/values/ExecutionRecord"
 *
 * console.log(typeof toExecutionOutcomeInsert) // "function"
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const toExecutionOutcomeInsert = (record: ExecutionOutcomeRecord): ExecutionOutcomeInsert =>
  encodeExecutionOutcome(record);

/**
 * Decode an outcome row back into the domain record.
 *
 * **Example** (Check fromExecutionOutcomeRow type)
 *
 * ```ts
 * import { fromExecutionOutcomeRow } from "@beep/epistemic-tables/values/ExecutionRecord"
 *
 * console.log(typeof fromExecutionOutcomeRow) // "function"
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const fromExecutionOutcomeRow = (row: ExecutionOutcomeRow): ExecutionOutcomeRecord =>
  decodeExecutionOutcomeRow(row);
