/**
 * Epistemic Evidence row converters.
 *
 * @packageDocumentation
 * @category tables
 * @since 0.0.0
 */

import { Evidence } from "@beep/epistemic-domain/entities/Evidence";
import { EvidenceSpan } from "@beep/epistemic-domain/values/EvidenceSpan";
import { $EpistemicTablesId } from "@beep/identity/packages";
import { TextAnchorFields } from "@beep/provenance/TextAnchor";
import { NonNegativeInt } from "@beep/schema";
import { pipe, Result } from "effect";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { Table } from "./Evidence.table.ts";

const $I = $EpistemicTablesId.create("entities/Evidence/Evidence.converters");

/**
 * Selected epistemic Evidence row.
 *
 * @example
 * ```ts
 * import type { EvidenceRow } from "@beep/epistemic-tables/entities/Evidence"
 *
 * const row = {
 *   artifactFixtureKey: "artifact:oa-1",
 *   createdAt: 1,
 *   createdByPrincipal: { kind: "System", component: "Runtime" },
 *   entityType: "EpistemicEvidence",
 *   id: 10,
 *   orgId: 1,
 *   publicId: "epistemic_evidence_a10",
 *   rowVersion: 1,
 *   schemaVersion: "0.0.0",
 *   source: "Agent",
 *   span: {
 *     confidence: 0.92,
 *     endChar: 57,
 *     quote: "a processor configured to receive sensor data",
 *     startChar: 12
 *   },
 *   spanFixtureKey: "span:oa-1:12-57",
 *   updatedAt: 1,
 *   updatedByPrincipal: { kind: "System", component: "Runtime" }
 * } satisfies EvidenceRow
 *
 * console.log(row.spanFixtureKey)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export type EvidenceRow = typeof Table.$inferSelect;

/**
 * Insertable epistemic Evidence row.
 *
 * @example
 * ```ts
 * import type { EvidenceInsert } from "@beep/epistemic-tables/entities/Evidence"
 *
 * const insert = {
 *   artifactFixtureKey: "artifact:oa-1",
 *   createdAt: 1,
 *   createdByPrincipal: { kind: "System", component: "Runtime" },
 *   entityType: "EpistemicEvidence",
 *   orgId: 1,
 *   publicId: "epistemic_evidence_a10",
 *   rowVersion: 1,
 *   schemaVersion: "0.0.0",
 *   source: "Agent",
 *   span: {
 *     confidence: 0.92,
 *     endChar: 57,
 *     quote: "a processor configured to receive sensor data",
 *     startChar: 12
 *   },
 *   spanFixtureKey: "span:oa-1:12-57",
 *   updatedAt: 1,
 *   updatedByPrincipal: { kind: "System", component: "Runtime" }
 * } satisfies EvidenceInsert
 *
 * console.log(insert.artifactFixtureKey)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export type EvidenceInsert = typeof Table.$inferInsert;

const encodeEvidence = S.encodeResult(Evidence);
const decodeEvidenceRow = S.decodeUnknownResult(Evidence);
class LegacyEvidenceSpan extends S.Class<LegacyEvidenceSpan>($I`LegacyEvidenceSpan`)(
  {
    confidence: EvidenceSpan.fields.confidence,
    endChar: EvidenceSpan.fields.endChar,
    quote: TextAnchorFields.quote,
    startChar: EvidenceSpan.fields.startChar,
  },
  $I.annote("LegacyEvidenceSpan", {
    description:
      "Persistence-read compatibility shape for evidence spans written before strict width and quote bounds.",
  })
) {}
const LegacyEvidence = Evidence.select
  .mapFields((fields) => ({
    ...fields,
    span: LegacyEvidenceSpan,
  }))
  .pipe(
    $I.annoteSchema("LegacyEvidence", {
      description: "Persistence-read compatibility schema for evidence rows written before strict span checks.",
    })
  );
const decodeLegacyEvidenceRow = S.decodeUnknownResult(LegacyEvidence);

const decodePersistedEvidence = (row: EvidenceRow): Result.Result<Evidence, S.SchemaError> =>
  pipe(
    decodeEvidenceRow(row),
    Result.orElse(() =>
      Result.flatMap(decodeLegacyEvidenceRow(row), (legacy) => {
        const endChar = NonNegativeInt.make(legacy.span.startChar + Str.length(legacy.span.quote));
        return pipe(
          decodeEvidenceRow({
            ...row,
            span: {
              ...row.span,
              endChar,
            },
          }),
          Result.orElse(() =>
            Result.succeed({
              ...legacy,
              span: {
                ...legacy.span,
                endChar,
              },
            })
          )
        );
      })
    )
  );

/**
 * Convert an Evidence entity into its persistence insert row.
 *
 * The schema-first entity is its own row codec: encoding yields the
 * snake_case column shape produced by {@link Table}. The database-managed
 * `id` (SERIAL) is dropped so the insert defers to the sequence.
 *
 * @example
 * ```ts
 * import { fromEvidenceRow, toEvidenceInsert } from "@beep/epistemic-tables/entities/Evidence"
 * import type { EvidenceRow } from "@beep/epistemic-tables/entities/Evidence"
 *
 * const row = {
 *   artifactFixtureKey: "artifact:oa-1",
 *   createdAt: 1,
 *   createdByPrincipal: { kind: "System", component: "Runtime" },
 *   entityType: "EpistemicEvidence",
 *   id: 10,
 *   orgId: 1,
 *   publicId: "epistemic_evidence_a10",
 *   rowVersion: 1,
 *   schemaVersion: "0.0.0",
 *   source: "Agent",
 *   span: {
 *     confidence: 0.92,
 *     endChar: 57,
 *     quote: "a processor configured to receive sensor data",
 *     startChar: 12
 *   },
 *   spanFixtureKey: "span:oa-1:12-57",
 *   updatedAt: 1,
 *   updatedByPrincipal: { kind: "System", component: "Runtime" }
 * } satisfies EvidenceRow
 *
 * const insert = toEvidenceInsert(fromEvidenceRow(row))
 * console.log("id" in insert) // false
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const toEvidenceInsert = (evidence: Evidence): EvidenceInsert => {
  const { id: _id, ...rest } = Result.getOrThrow(encodeEvidence(evidence));
  return rest;
};

/**
 * Convert a selected persistence row into an Evidence entity.
 *
 * @example
 * ```ts
 * import { fromEvidenceRow } from "@beep/epistemic-tables/entities/Evidence"
 * import type { EvidenceRow } from "@beep/epistemic-tables/entities/Evidence"
 *
 * const row = {
 *   artifactFixtureKey: "artifact:oa-1",
 *   createdAt: 1,
 *   createdByPrincipal: { kind: "System", component: "Runtime" },
 *   entityType: "EpistemicEvidence",
 *   id: 10,
 *   orgId: 1,
 *   publicId: "epistemic_evidence_a10",
 *   rowVersion: 1,
 *   schemaVersion: "0.0.0",
 *   source: "Agent",
 *   span: {
 *     confidence: 0.92,
 *     endChar: 57,
 *     quote: "a processor configured to receive sensor data",
 *     startChar: 12
 *   },
 *   spanFixtureKey: "span:oa-1:12-57",
 *   updatedAt: 1,
 *   updatedByPrincipal: { kind: "System", component: "Runtime" }
 * } satisfies EvidenceRow
 *
 * const evidence = fromEvidenceRow(row)
 * console.log(evidence.span.quote)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const fromEvidenceRow = (row: EvidenceRow): Evidence => Result.getOrThrow(decodePersistedEvidence(row));
