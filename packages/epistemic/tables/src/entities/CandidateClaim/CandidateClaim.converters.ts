/**
 * Epistemic CandidateClaim row converters.
 *
 * @packageDocumentation
 * @category tables
 * @since 0.0.0
 */

import { CandidateClaim } from "@beep/epistemic-domain/entities/CandidateClaim";
import * as S from "effect/Schema";
import type { Table } from "./CandidateClaim.table.ts";

/**
 * Selected epistemic CandidateClaim row.
 *
 * @example
 * ```ts
 * import type { CandidateClaimRow } from "@beep/epistemic-tables/entities/CandidateClaim"
 *
 * const row = {
 *   createdAt: 1,
 *   createdByPrincipal: { kind: "System", component: "Runtime" },
 *   entityType: "EpistemicCandidateClaim",
 *   fixtureKey: "claim:patentability",
 *   id: 10,
 *   lifecycle: "candidate",
 *   orgId: 1,
 *   publicId: "epistemic_candidate_claim_a10",
 *   rowVersion: 1,
 *   schemaVersion: "0.0.0",
 *   snapshot: { text: "The application describes a processor." },
 *   source: "Agent",
 *   updatedAt: 1,
 *   updatedByPrincipal: { kind: "System", component: "Runtime" }
 * } satisfies CandidateClaimRow
 *
 * console.log(row.lifecycle)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export type CandidateClaimRow = typeof Table.$inferSelect;

/**
 * Insertable epistemic CandidateClaim row.
 *
 * @example
 * ```ts
 * import type { CandidateClaimInsert } from "@beep/epistemic-tables/entities/CandidateClaim"
 *
 * const insert = {
 *   createdAt: 1,
 *   createdByPrincipal: { kind: "System", component: "Runtime" },
 *   entityType: "EpistemicCandidateClaim",
 *   fixtureKey: "claim:patentability",
 *   lifecycle: "candidate",
 *   orgId: 1,
 *   publicId: "epistemic_candidate_claim_a10",
 *   rowVersion: 1,
 *   schemaVersion: "0.0.0",
 *   snapshot: { text: "The application describes a processor." },
 *   source: "Agent",
 *   updatedAt: 1,
 *   updatedByPrincipal: { kind: "System", component: "Runtime" }
 * } satisfies CandidateClaimInsert
 *
 * console.log(insert.fixtureKey)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export type CandidateClaimInsert = typeof Table.$inferInsert;

const encodeCandidateClaim = S.encodeSync(CandidateClaim);
const decodeCandidateClaimRow = S.decodeUnknownSync(CandidateClaim);

/**
 * Convert a CandidateClaim entity into its persistence insert row.
 *
 * The schema-first entity is its own row codec: encoding yields the
 * snake_case column shape produced by {@link Table}. The database-managed
 * `id` (SERIAL) is dropped so the insert defers to the sequence.
 *
 * @example
 * ```ts
 * import { fromCandidateClaimRow, toCandidateClaimInsert } from "@beep/epistemic-tables/entities/CandidateClaim"
 * import type { CandidateClaimRow } from "@beep/epistemic-tables/entities/CandidateClaim"
 *
 * const row = {
 *   createdAt: 1,
 *   createdByPrincipal: { kind: "System", component: "Runtime" },
 *   entityType: "EpistemicCandidateClaim",
 *   fixtureKey: "claim:patentability",
 *   id: 10,
 *   lifecycle: "candidate",
 *   orgId: 1,
 *   publicId: "epistemic_candidate_claim_a10",
 *   rowVersion: 1,
 *   schemaVersion: "0.0.0",
 *   snapshot: { text: "The application describes a processor." },
 *   source: "Agent",
 *   updatedAt: 1,
 *   updatedByPrincipal: { kind: "System", component: "Runtime" }
 * } satisfies CandidateClaimRow
 *
 * const insert = toCandidateClaimInsert(fromCandidateClaimRow(row))
 * console.log("id" in insert) // false
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const toCandidateClaimInsert = (candidateClaim: CandidateClaim): CandidateClaimInsert => {
  const { id: _id, ...rest } = encodeCandidateClaim(candidateClaim);
  return rest as CandidateClaimInsert;
};

/**
 * Convert a selected persistence row into a CandidateClaim entity.
 *
 * @example
 * ```ts
 * import { fromCandidateClaimRow } from "@beep/epistemic-tables/entities/CandidateClaim"
 * import type { CandidateClaimRow } from "@beep/epistemic-tables/entities/CandidateClaim"
 *
 * const row = {
 *   createdAt: 1,
 *   createdByPrincipal: { kind: "System", component: "Runtime" },
 *   entityType: "EpistemicCandidateClaim",
 *   fixtureKey: "claim:patentability",
 *   id: 10,
 *   lifecycle: "candidate",
 *   orgId: 1,
 *   publicId: "epistemic_candidate_claim_a10",
 *   rowVersion: 1,
 *   schemaVersion: "0.0.0",
 *   snapshot: { text: "The application describes a processor." },
 *   source: "Agent",
 *   updatedAt: 1,
 *   updatedByPrincipal: { kind: "System", component: "Runtime" }
 * } satisfies CandidateClaimRow
 *
 * const claim = fromCandidateClaimRow(row)
 * console.log(claim.lifecycle)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const fromCandidateClaimRow = (row: CandidateClaimRow): CandidateClaim => decodeCandidateClaimRow(row);
