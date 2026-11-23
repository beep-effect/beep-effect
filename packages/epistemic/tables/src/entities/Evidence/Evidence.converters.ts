/**
 * Epistemic Evidence row converters.
 *
 * @packageDocumentation
 * @category tables
 * @since 0.0.0
 */

import { Evidence, LegacyEvidenceUnresolved } from "@beep/epistemic-domain/entities/Evidence";
import { Confidence, ReportedConfidence } from "@beep/epistemics/Confidence";
import { EvidencePosition, ExtractorConfidence } from "@beep/epistemics/EvidencePosition.schema";
import { $EpistemicTablesId } from "@beep/identity/packages";
import { TextAnchor } from "@beep/text/TextAnchor";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { EvidenceConverterError } from "./Evidence.errors.ts";
import type { Table } from "./Evidence.table.ts";

const $I = $EpistemicTablesId.create("entities/Evidence/Evidence.converters");

/**
 * Selected epistemic Evidence row.
 *
 * **Example** (Sample EvidenceRow fixture)
 *
 * ```ts
 * import type { EvidenceRow } from "@beep/epistemic-tables/entities/Evidence"
 *
 * const row = {
 *   artifactFixtureKey: "artifact:oa-1",
 *   createdAt: 1,
 *   createdByPrincipal: { kind: "System", component: "Runtime" },
 *   deletedAt: null,
 *   deletedByPrincipal: null,
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
 * **Example** (Sample EvidenceInsert fixture)
 *
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
const ReadPosition = S.Union([EvidencePosition, LegacyEvidenceUnresolved]).pipe(
  $I.annoteSchema("ReadPosition", { description: "Current evidence or explicitly unresolved historical metadata." })
);
const encodeReadPosition = S.encodeResult(ReadPosition);
const decodeEvidenceRow = S.decodeUnknownResult(Evidence);
class FrozenPosition extends S.Opaque<FrozenPosition, { readonly brand: unique symbol }>()(
  S.Struct({
    confidence: Confidence,
    endChar: S.Natural,
    quote: S.String,
    startChar: S.Natural,
  }).pipe($I.annoteSchema("FrozenPosition", { description: "Private frozen pre-v2 position payload." }))
) {}

const decodeFrozenPosition = S.decodeUnknownResult(FrozenPosition);
const validateCurrentPosition = S.decodeUnknownResult(S.toType(EvidencePosition));
const decodeCurrentPosition = S.decodeUnknownResult(EvidencePosition);
const decodeAnchor = S.decodeUnknownResult(TextAnchor);
const decodePersistedPosition = (
  span: EvidenceRow["span"]
): Result.Result<EvidencePosition | LegacyEvidenceUnresolved, S.SchemaError> =>
  P.hasProperty(span, "version")
    ? decodeCurrentPosition(span)
    : Result.flatMap(decodeFrozenPosition(span), (raw) => {
        const anchor = decodeAnchor({
          startChar: raw.startChar,
          endChar: raw.startChar + Str.length(raw.quote),
          quote: raw.quote,
        });
        return Result.succeed(
          Result.match(anchor, {
            onFailure: () => LegacyEvidenceUnresolved.make(raw),
            onSuccess: (position) =>
              O.getOrElse(
                EvidencePosition.makeOption({
                  position,
                  extractorConfidence: ExtractorConfidence.cases.Present.make({
                    value: ReportedConfidence.make({
                      value: raw.confidence,
                      method: "legacy-reported",
                      producer: O.none(),
                    }),
                  }),
                }),
                () => LegacyEvidenceUnresolved.make(raw)
              ),
          })
        );
      });
const decodePersistedEvidence = (row: EvidenceRow): Result.Result<Evidence, S.SchemaError> =>
  Result.flatMap(decodePersistedPosition(row.span), (span) =>
    Result.flatMap(encodeReadPosition(span), (encoded) => decodeEvidenceRow({ ...row, span: encoded }))
  );

/**
 * Convert an Evidence entity into its persistence insert row.
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
 * import { fromEvidenceRow, toEvidenceInsert } from "@beep/epistemic-tables/entities/Evidence"
 * import type { EvidenceRow } from "@beep/epistemic-tables/entities/Evidence"
 * import * as Result from "effect/Result"
 *
 * const row = {
 *   artifactFixtureKey: "artifact:oa-1",
 *   createdAt: 1,
 *   createdByPrincipal: { kind: "System", component: "Runtime" },
 *   deletedAt: null,
 *   deletedByPrincipal: null,
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
 * const insert = toEvidenceInsert(Result.getOrThrow(fromEvidenceRow(row)))
 * console.log("id" in Result.getOrThrow(insert)) // false
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const toEvidenceInsert = (evidence: Evidence): Result.Result<EvidenceInsert, EvidenceConverterError> =>
  Result.mapError(
    Result.map(
      Result.flatMap(validateCurrentPosition(evidence.span), () => encodeEvidence(evidence)),
      (encoded): EvidenceInsert => {
        const { id: _id, ...rest } = encoded;
        return rest as EvidenceInsert;
      }
    ),
    (error) => EvidenceConverterError.fromSchema("toInsert", error)
  );

/**
 * Convert a selected persistence row into an Evidence entity.
 *
 * **Example** (Decode row to entity)
 *
 * ```ts
 * import { fromEvidenceRow } from "@beep/epistemic-tables/entities/Evidence"
 * import type { EvidenceRow } from "@beep/epistemic-tables/entities/Evidence"
 * import * as Result from "effect/Result"
 *
 * const row = {
 *   artifactFixtureKey: "artifact:oa-1",
 *   createdAt: 1,
 *   createdByPrincipal: { kind: "System", component: "Runtime" },
 *   deletedAt: null,
 *   deletedByPrincipal: null,
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
 * const evidence = Result.getOrThrow(fromEvidenceRow(row))
 * console.log(evidence.span)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const fromEvidenceRow = (row: EvidenceRow): Result.Result<Evidence, EvidenceConverterError> =>
  Result.mapError(decodePersistedEvidence(row), (error) => EvidenceConverterError.fromSchema("fromRow", error));
