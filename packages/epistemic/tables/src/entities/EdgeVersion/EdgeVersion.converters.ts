/**
 * Epistemic EdgeVersion row converters.
 *
 * Both temporal axes cross this boundary as plain epoch millis: an open upper
 * bound is `null` in the row and `Option.none` in the entity, so the absence of
 * a bound survives the round trip without a sentinel date standing in for it.
 *
 * @packageDocumentation
 * @category tables
 * @since 0.0.0
 */

import { EdgeVersion } from "@beep/epistemic-domain/entities/EdgeVersion";
import * as S from "effect/Schema";
import type { Table } from "./EdgeVersion.table.ts";

/**
 * Selected epistemic EdgeVersion row.
 *
 * **Example** (Satisfies EdgeVersionRow shape)
 *
 * ```ts
 * import type { EdgeVersionRow } from "@beep/epistemic-tables/entities/EdgeVersion"
 *
 * const row = {
 *   createdAt: 1,
 *   createdByPrincipal: { kind: "System", component: "Runtime" },
 *   entityType: "EpistemicEdgeVersion",
 *   evidenceScope: null,
 *   expiredAt: null,
 *   fact: { note: "cited in the office action" },
 *   id: 10,
 *   logicalKey: "abadcafeabadcafeabadcafeabadcafeabadcafeabadcafeabadcafeabadcafe",
 *   matterScope: null,
 *   orgId: 1,
 *   publicId: "epistemic_edge_version_a10",
 *   qualifiers: { statute: "35 USC 103" },
 *   recordedAt: 1_000,
 *   relation: "supports",
 *   rowVersion: 1,
 *   schemaVersion: "0.0.0",
 *   source: "Agent",
 *   sourceClaimId: 1,
 *   sourceEntityRef: null,
 *   sourceEvidenceId: null,
 *   sourceKind: "claim",
 *   sourceObservationRef: null,
 *   supersedesId: null,
 *   targetClaimId: null,
 *   targetEntityRef: null,
 *   targetEvidenceId: 2,
 *   targetKind: "evidence",
 *   targetObservationRef: null,
 *   updatedAt: 1,
 *   updatedByPrincipal: { kind: "System", component: "Runtime" },
 *   validFrom: 1_000,
 *   validTo: null,
 *   version: 1
 * } satisfies EdgeVersionRow
 *
 * console.log(row.relation)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export type EdgeVersionRow = typeof Table.$inferSelect;

/**
 * Insertable epistemic EdgeVersion row.
 *
 * **Example** (Satisfies EdgeVersionInsert shape)
 *
 * ```ts
 * import type { EdgeVersionInsert } from "@beep/epistemic-tables/entities/EdgeVersion"
 *
 * const insert = {
 *   createdAt: 1,
 *   createdByPrincipal: { kind: "System", component: "Runtime" },
 *   entityType: "EpistemicEdgeVersion",
 *   evidenceScope: null,
 *   expiredAt: null,
 *   fact: { note: "cited in the office action" },
 *   logicalKey: "abadcafeabadcafeabadcafeabadcafeabadcafeabadcafeabadcafeabadcafe",
 *   matterScope: null,
 *   orgId: 1,
 *   publicId: "epistemic_edge_version_a10",
 *   qualifiers: { statute: "35 USC 103" },
 *   recordedAt: 1_000,
 *   relation: "supports",
 *   rowVersion: 1,
 *   schemaVersion: "0.0.0",
 *   source: "Agent",
 *   sourceClaimId: 1,
 *   sourceEntityRef: null,
 *   sourceEvidenceId: null,
 *   sourceKind: "claim",
 *   sourceObservationRef: null,
 *   supersedesId: null,
 *   targetClaimId: null,
 *   targetEntityRef: null,
 *   targetEvidenceId: 2,
 *   targetKind: "evidence",
 *   targetObservationRef: null,
 *   updatedAt: 1,
 *   updatedByPrincipal: { kind: "System", component: "Runtime" },
 *   validFrom: 1_000,
 *   validTo: null,
 *   version: 1
 * } satisfies EdgeVersionInsert
 *
 * console.log(insert.version)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export type EdgeVersionInsert = typeof Table.$inferInsert;

const encodeEdgeVersion = S.encodeSync(EdgeVersion);
const decodeEdgeVersionRow = S.decodeUnknownSync(EdgeVersion);

/**
 * Convert an EdgeVersion entity into its persistence insert row.
 *
 * **Details**
 *
 * The schema-first entity is its own row codec: encoding yields the
 * snake_case column shape produced by {@link Table}. The database-managed
 * `id` (SERIAL) is dropped so the insert defers to the sequence.
 *
 * **Example** (Drops id from insert)
 *
 * ```ts
 * import { fromEdgeVersionRow, toEdgeVersionInsert } from "@beep/epistemic-tables/entities/EdgeVersion"
 * import type { EdgeVersionRow } from "@beep/epistemic-tables/entities/EdgeVersion"
 *
 * const row = {
 *   createdAt: 1,
 *   createdByPrincipal: { kind: "System", component: "Runtime" },
 *   entityType: "EpistemicEdgeVersion",
 *   evidenceScope: null,
 *   expiredAt: null,
 *   fact: { note: "cited in the office action" },
 *   id: 10,
 *   logicalKey: "abadcafeabadcafeabadcafeabadcafeabadcafeabadcafeabadcafeabadcafe",
 *   matterScope: null,
 *   orgId: 1,
 *   publicId: "epistemic_edge_version_a10",
 *   qualifiers: { statute: "35 USC 103" },
 *   recordedAt: 1_000,
 *   relation: "supports",
 *   rowVersion: 1,
 *   schemaVersion: "0.0.0",
 *   source: "Agent",
 *   sourceClaimId: 1,
 *   sourceEntityRef: null,
 *   sourceEvidenceId: null,
 *   sourceKind: "claim",
 *   sourceObservationRef: null,
 *   supersedesId: null,
 *   targetClaimId: null,
 *   targetEntityRef: null,
 *   targetEvidenceId: 2,
 *   targetKind: "evidence",
 *   targetObservationRef: null,
 *   updatedAt: 1,
 *   updatedByPrincipal: { kind: "System", component: "Runtime" },
 *   validFrom: 1_000,
 *   validTo: null,
 *   version: 1
 * } satisfies EdgeVersionRow
 *
 * const insert = toEdgeVersionInsert(fromEdgeVersionRow(row))
 * console.log("id" in insert) // false
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const toEdgeVersionInsert = (edgeVersion: EdgeVersion): EdgeVersionInsert => {
  const { id: _id, ...rest } = encodeEdgeVersion(edgeVersion);
  return rest as EdgeVersionInsert;
};

/**
 * Convert a selected persistence row into an EdgeVersion entity.
 *
 * **Example** (Row to entity conversion)
 *
 * ```ts
 * import { fromEdgeVersionRow } from "@beep/epistemic-tables/entities/EdgeVersion"
 * import type { EdgeVersionRow } from "@beep/epistemic-tables/entities/EdgeVersion"
 * import * as O from "effect/Option"
 *
 * const row = {
 *   createdAt: 1,
 *   createdByPrincipal: { kind: "System", component: "Runtime" },
 *   entityType: "EpistemicEdgeVersion",
 *   evidenceScope: null,
 *   expiredAt: null,
 *   fact: { note: "cited in the office action" },
 *   id: 10,
 *   logicalKey: "abadcafeabadcafeabadcafeabadcafeabadcafeabadcafeabadcafeabadcafe",
 *   matterScope: null,
 *   orgId: 1,
 *   publicId: "epistemic_edge_version_a10",
 *   qualifiers: { statute: "35 USC 103" },
 *   recordedAt: 1_000,
 *   relation: "supports",
 *   rowVersion: 1,
 *   schemaVersion: "0.0.0",
 *   source: "Agent",
 *   sourceClaimId: 1,
 *   sourceEntityRef: null,
 *   sourceEvidenceId: null,
 *   sourceKind: "claim",
 *   sourceObservationRef: null,
 *   supersedesId: null,
 *   targetClaimId: null,
 *   targetEntityRef: null,
 *   targetEvidenceId: 2,
 *   targetKind: "evidence",
 *   targetObservationRef: null,
 *   updatedAt: 1,
 *   updatedByPrincipal: { kind: "System", component: "Runtime" },
 *   validFrom: 1_000,
 *   validTo: null,
 *   version: 1
 * } satisfies EdgeVersionRow
 *
 * const version = fromEdgeVersionRow(row)
 * console.log(O.isNone(version.validTo)) // true — the fact is still held true
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const fromEdgeVersionRow = (row: EdgeVersionRow): EdgeVersion => decodeEdgeVersionRow(row);
