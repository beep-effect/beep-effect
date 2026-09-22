/**
 * Epistemic CandidateClaim row converters.
 *
 * @packageDocumentation
 * @category tables
 * @since 0.0.0
 */

import { CandidateClaim } from "@beep/epistemic-domain/entities/CandidateClaim";
import { Result } from "effect";
import * as S from "effect/Schema";
import { CandidateClaimConverterError } from "./CandidateClaim.errors.ts";
import type { Table } from "./CandidateClaim.table.ts";

/**
 * Selected epistemic CandidateClaim row.
 *
 * **Example** (Satisfy CandidateClaimRow type)
 *
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
 * **Example** (Satisfy CandidateClaimInsert type)
 *
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

const encodeCandidateClaim = S.encodeResult(CandidateClaim);
const decodeCandidateClaimRow = S.decodeUnknownResult(CandidateClaim);

/**
 * Convert a CandidateClaim entity into its persistence insert row.
 *
 * **Details**
 *
 * The schema-first entity is its own row codec: encoding yields the
 * snake_case column shape produced by {@link Table}. The database-managed
 * `id` (SERIAL) is dropped so the insert defers to the sequence.
 *
 * **Example** (Insert omits database id)
 *
 * ```ts
 * import { fromCandidateClaimRow, toCandidateClaimInsert } from "@beep/epistemic-tables/entities/CandidateClaim"
 * import type { CandidateClaimRow } from "@beep/epistemic-tables/entities/CandidateClaim"
 * import { Result } from "effect"
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
 * const insert = toCandidateClaimInsert(Result.getOrThrow(fromCandidateClaimRow(row)))
 * console.log("id" in Result.getOrThrow(insert)) // false
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const toCandidateClaimInsert = (
  candidateClaim: CandidateClaim
): Result.Result<CandidateClaimInsert, CandidateClaimConverterError> =>
  Result.mapError(
    Result.map(encodeCandidateClaim(candidateClaim), (encoded): CandidateClaimInsert => {
      const { id: _id, ...rest } = encoded;
      return rest as CandidateClaimInsert;
    }),
    (error) => CandidateClaimConverterError.fromSchema("toInsert", error)
  );

/**
 * Convert a selected persistence row into a CandidateClaim entity.
 *
 * **Example** (Decode row to entity)
 *
 * ```ts
 * import { fromCandidateClaimRow } from "@beep/epistemic-tables/entities/CandidateClaim"
 * import type { CandidateClaimRow } from "@beep/epistemic-tables/entities/CandidateClaim"
 * import { Result } from "effect"
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
 * const claim = Result.getOrThrow(fromCandidateClaimRow(row))
 * console.log(claim.lifecycle)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const fromCandidateClaimRow = (
  row: CandidateClaimRow
): Result.Result<CandidateClaim, CandidateClaimConverterError> =>
  Result.mapError(decodeCandidateClaimRow(row), (error) => CandidateClaimConverterError.fromSchema("fromRow", error));
