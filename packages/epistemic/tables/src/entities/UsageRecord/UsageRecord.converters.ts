/**
 * Epistemic UsageRecord row converters.
 *
 * @packageDocumentation
 * @category tables
 * @since 0.0.0
 */

import { UsageRecord } from "@beep/epistemic-domain/entities/UsageRecord";
import * as S from "effect/Schema";
import type { Table } from "./UsageRecord.table.ts";

/**
 * Selected epistemic UsageRecord row.
 *
 * @example
 * ```ts
 * import type { UsageRecordRow } from "@beep/epistemic-tables/entities/UsageRecord"
 *
 * const row = {
 *   activityId: 7,
 *   actor: { kind: "System", component: "Runtime" },
 *   costUsdApproxMicros: null,
 *   createdAt: 1,
 *   createdByPrincipal: { kind: "System", component: "Runtime" },
 *   credentialReference: null,
 *   entityType: "EpistemicUsageRecord",
 *   id: 10,
 *   inputTokens: 12,
 *   latencyMillis: null,
 *   metadata: { trace: "fixture" },
 *   model: "fixture-model",
 *   orgId: 1,
 *   outputTokens: 34,
 *   provider: "fixture",
 *   publicId: "epistemic_usage_record_a10",
 *   rowVersion: 1,
 *   schemaVersion: "0.0.0",
 *   source: "Agent",
 *   totalTokens: 46,
 *   unitCount: null,
 *   updatedAt: 1,
 *   updatedByPrincipal: { kind: "System", component: "Runtime" }
 * } satisfies UsageRecordRow
 *
 * console.log(row.provider)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export type UsageRecordRow = typeof Table.$inferSelect;

/**
 * Insertable epistemic UsageRecord row.
 *
 * @example
 * ```ts
 * import type { UsageRecordInsert } from "@beep/epistemic-tables/entities/UsageRecord"
 *
 * const insert = {
 *   activityId: 7,
 *   actor: { kind: "System", component: "Runtime" },
 *   costUsdApproxMicros: null,
 *   createdAt: 1,
 *   createdByPrincipal: { kind: "System", component: "Runtime" },
 *   credentialReference: null,
 *   entityType: "EpistemicUsageRecord",
 *   inputTokens: 12,
 *   latencyMillis: null,
 *   metadata: { trace: "fixture" },
 *   model: "fixture-model",
 *   orgId: 1,
 *   outputTokens: 34,
 *   provider: "fixture",
 *   publicId: "epistemic_usage_record_a10",
 *   rowVersion: 1,
 *   schemaVersion: "0.0.0",
 *   source: "Agent",
 *   totalTokens: 46,
 *   unitCount: null,
 *   updatedAt: 1,
 *   updatedByPrincipal: { kind: "System", component: "Runtime" }
 * } satisfies UsageRecordInsert
 *
 * console.log(insert.provider)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export type UsageRecordInsert = typeof Table.$inferInsert;

const encodeUsageRecord = S.encodeSync(UsageRecord);
const decodeUsageRecordRow = S.decodeUnknownSync(UsageRecord);

/**
 * Convert a UsageRecord entity into its persistence insert row.
 *
 * The schema-first entity is its own row codec: encoding yields the
 * snake_case column shape produced by {@link Table}. The database-managed
 * `id` (SERIAL) is dropped so the insert defers to the sequence.
 *
 * @example
 * ```ts
 * import { fromUsageRecordRow, toUsageRecordInsert } from "@beep/epistemic-tables/entities/UsageRecord"
 * import type { UsageRecordRow } from "@beep/epistemic-tables/entities/UsageRecord"
 *
 * const row = {
 *   activityId: 7,
 *   actor: { kind: "System", component: "Runtime" },
 *   costUsdApproxMicros: null,
 *   createdAt: 1,
 *   createdByPrincipal: { kind: "System", component: "Runtime" },
 *   credentialReference: null,
 *   entityType: "EpistemicUsageRecord",
 *   id: 10,
 *   inputTokens: 12,
 *   latencyMillis: null,
 *   metadata: { trace: "fixture" },
 *   model: "fixture-model",
 *   orgId: 1,
 *   outputTokens: 34,
 *   provider: "fixture",
 *   rowVersion: 1,
 *   schemaVersion: "0.0.0",
 *   source: "Agent",
 *   totalTokens: 46,
 *   unitCount: null,
 *   updatedAt: 1,
 *   updatedByPrincipal: { kind: "System", component: "Runtime" }
 * } satisfies UsageRecordRow
 *
 * const insert = toUsageRecordInsert(fromUsageRecordRow(row))
 * console.log("id" in insert) // false
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const toUsageRecordInsert = (usageRecord: UsageRecord): UsageRecordInsert => {
  const { id: _id, ...rest } = encodeUsageRecord(usageRecord);
  return rest as UsageRecordInsert;
};

/**
 * Convert a selected persistence row into a UsageRecord entity.
 *
 * @example
 * ```ts
 * import { fromUsageRecordRow } from "@beep/epistemic-tables/entities/UsageRecord"
 * import type { UsageRecordRow } from "@beep/epistemic-tables/entities/UsageRecord"
 *
 * const row = {
 *   activityId: 7,
 *   actor: { kind: "System", component: "Runtime" },
 *   costUsdApproxMicros: null,
 *   createdAt: 1,
 *   createdByPrincipal: { kind: "System", component: "Runtime" },
 *   credentialReference: null,
 *   entityType: "EpistemicUsageRecord",
 *   id: 10,
 *   inputTokens: 12,
 *   latencyMillis: null,
 *   metadata: { trace: "fixture" },
 *   model: "fixture-model",
 *   orgId: 1,
 *   outputTokens: 34,
 *   provider: "fixture",
 *   rowVersion: 1,
 *   schemaVersion: "0.0.0",
 *   source: "Agent",
 *   totalTokens: 46,
 *   unitCount: null,
 *   updatedAt: 1,
 *   updatedByPrincipal: { kind: "System", component: "Runtime" }
 * } satisfies UsageRecordRow
 *
 * const usage = fromUsageRecordRow(row)
 * console.log(usage.provider)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const fromUsageRecordRow = (row: UsageRecordRow): UsageRecord => decodeUsageRecordRow(row);
