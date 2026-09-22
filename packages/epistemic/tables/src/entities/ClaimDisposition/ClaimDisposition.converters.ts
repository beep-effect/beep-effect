/**
 * Epistemic ClaimDisposition row converters.
 *
 * @packageDocumentation
 * @category tables
 * @since 0.0.0
 */

import { ClaimDisposition } from "@beep/epistemic-domain/entities/ClaimDisposition";
import { Result } from "effect";
import * as S from "effect/Schema";
import { ClaimDispositionConverterError } from "./ClaimDisposition.errors.ts";
import type { Table } from "./ClaimDisposition.table.ts";

/**
 * Selected epistemic ClaimDisposition row.
 *
 * **Example** (Selected row with violations)
 *
 * ```ts
 * import type { ClaimDispositionRow } from "@beep/epistemic-tables/entities/ClaimDisposition"
 *
 * const row = {
 *   claimId: 3,
 *   createdAt: 1,
 *   createdByPrincipal: { kind: "System", component: "Runtime" },
 *   entityType: "EpistemicClaimDisposition",
 *   id: 10,
 *   orgId: 1,
 *   publicId: "epistemic_claim_disposition_a10",
 *   reason: "Expected at least 1 value(s) for evidence.",
 *   resolvedAt: 1_000,
 *   resolvedBy: { kind: "System", component: "Runtime" },
 *   rowVersion: 1,
 *   schemaVersion: "0.0.0",
 *   source: "Agent",
 *   status: "rejected",
 *   updatedAt: 1,
 *   updatedByPrincipal: { kind: "System", component: "Runtime" },
 *   violations: [
 *     {
 *       focusNode: "https://beep.dev/epistemic/claim/patentability",
 *       message: "Expected at least 1 value(s) for evidence.",
 *       path: "https://beep.dev/epistemic/hasEvidenceQuote",
 *       severity: "violation"
 *     }
 *   ]
 * } satisfies ClaimDispositionRow
 *
 * console.log(row.status)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export type ClaimDispositionRow = typeof Table.$inferSelect;

/**
 * Insertable epistemic ClaimDisposition row.
 *
 * **Example** (Insertable row without id)
 *
 * ```ts
 * import type { ClaimDispositionInsert } from "@beep/epistemic-tables/entities/ClaimDisposition"
 *
 * const insert = {
 *   claimId: 3,
 *   createdAt: 1,
 *   createdByPrincipal: { kind: "System", component: "Runtime" },
 *   entityType: "EpistemicClaimDisposition",
 *   orgId: 1,
 *   publicId: "epistemic_claim_disposition_a10",
 *   reason: "Expected at least 1 value(s) for evidence.",
 *   resolvedAt: 1_000,
 *   resolvedBy: { kind: "System", component: "Runtime" },
 *   rowVersion: 1,
 *   schemaVersion: "0.0.0",
 *   source: "Agent",
 *   status: "rejected",
 *   updatedAt: 1,
 *   updatedByPrincipal: { kind: "System", component: "Runtime" },
 *   violations: []
 * } satisfies ClaimDispositionInsert
 *
 * console.log(insert.reason)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export type ClaimDispositionInsert = typeof Table.$inferInsert;

const encodeClaimDisposition = S.encodeResult(ClaimDisposition);
const decodeClaimDispositionRow = S.decodeUnknownResult(ClaimDisposition);

/**
 * Convert a ClaimDisposition entity into its persistence insert row.
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
 * import { fromClaimDispositionRow, toClaimDispositionInsert } from "@beep/epistemic-tables/entities/ClaimDisposition"
 * import type { ClaimDispositionRow } from "@beep/epistemic-tables/entities/ClaimDisposition"
 * import * as Result from "effect/Result"
 *
 * const row = {
 *   claimId: 3,
 *   createdAt: 1,
 *   createdByPrincipal: { kind: "System", component: "Runtime" },
 *   entityType: "EpistemicClaimDisposition",
 *   id: 10,
 *   orgId: 1,
 *   publicId: "epistemic_claim_disposition_a10",
 *   reason: "Expected at least 1 value(s) for evidence.",
 *   resolvedAt: 1_000,
 *   resolvedBy: { kind: "System", component: "Runtime" },
 *   rowVersion: 1,
 *   schemaVersion: "0.0.0",
 *   source: "Agent",
 *   status: "rejected",
 *   updatedAt: 1,
 *   updatedByPrincipal: { kind: "System", component: "Runtime" },
 *   violations: [
 *     {
 *       focusNode: "https://beep.dev/epistemic/claim/patentability",
 *       message: "Expected at least 1 value(s) for evidence.",
 *       path: "https://beep.dev/epistemic/hasEvidenceQuote",
 *       severity: "violation"
 *     }
 *   ]
 * } satisfies ClaimDispositionRow
 *
 * const insert = toClaimDispositionInsert(Result.getOrThrow(fromClaimDispositionRow(row)))
 * console.log("id" in Result.getOrThrow(insert)) // false
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const toClaimDispositionInsert = (
  claimDisposition: ClaimDisposition
): Result.Result<ClaimDispositionInsert, ClaimDispositionConverterError> =>
  Result.mapError(
    Result.map(encodeClaimDisposition(claimDisposition), (encoded): ClaimDispositionInsert => {
      const { id: _id, ...rest } = encoded;
      return rest as ClaimDispositionInsert;
    }),
    (error) => ClaimDispositionConverterError.fromSchema("toInsert", error)
  );

/**
 * Convert a selected persistence row into a ClaimDisposition entity.
 *
 * **Example** (Decode row to entity)
 *
 * ```ts
 * import { fromClaimDispositionRow } from "@beep/epistemic-tables/entities/ClaimDisposition"
 * import type { ClaimDispositionRow } from "@beep/epistemic-tables/entities/ClaimDisposition"
 * import * as Result from "effect/Result"
 *
 * const row = {
 *   claimId: 3,
 *   createdAt: 1,
 *   createdByPrincipal: { kind: "System", component: "Runtime" },
 *   entityType: "EpistemicClaimDisposition",
 *   id: 10,
 *   orgId: 1,
 *   publicId: "epistemic_claim_disposition_a10",
 *   reason: "Expected at least 1 value(s) for evidence.",
 *   resolvedAt: 1_000,
 *   resolvedBy: { kind: "System", component: "Runtime" },
 *   rowVersion: 1,
 *   schemaVersion: "0.0.0",
 *   source: "Agent",
 *   status: "rejected",
 *   updatedAt: 1,
 *   updatedByPrincipal: { kind: "System", component: "Runtime" },
 *   violations: [
 *     {
 *       focusNode: "https://beep.dev/epistemic/claim/patentability",
 *       message: "Expected at least 1 value(s) for evidence.",
 *       path: "https://beep.dev/epistemic/hasEvidenceQuote",
 *       severity: "violation"
 *     }
 *   ]
 * } satisfies ClaimDispositionRow
 *
 * const disposition = Result.getOrThrow(fromClaimDispositionRow(row))
 * console.log(disposition.status)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const fromClaimDispositionRow = (
  row: ClaimDispositionRow
): Result.Result<ClaimDisposition, ClaimDispositionConverterError> =>
  Result.mapError(decodeClaimDispositionRow(row), (error) =>
    ClaimDispositionConverterError.fromSchema("fromRow", error)
  );
