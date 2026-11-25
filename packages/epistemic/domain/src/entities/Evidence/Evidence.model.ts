/**
 * Evidence entity model.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { EpistemicFixtureKey } from "@beep/epistemic-domain/values";
import { Confidence } from "@beep/epistemics/Confidence";
import { EvidencePosition } from "@beep/epistemics/EvidencePosition.schema";
import { $EpistemicDomainId } from "@beep/identity/packages";
import * as ProductEntity from "@beep/shared-domain/entity/ProductEntity";
import * as Epistemic from "@beep/shared-domain/identity/Epistemic";
import * as S from "effect/Schema";

const $I = $EpistemicDomainId.create("entities/Evidence/Evidence.model");
const pg = ProductEntity.pg;

/**
 * Historical position metadata that cannot satisfy current anchor constraints.
 *
 * **Example** (Retain an empty legacy quote)
 *
 * ```ts
 * import { LegacyEvidenceUnresolved } from "@beep/epistemic-domain/entities/Evidence"
 * import { Confidence } from "@beep/epistemics/Confidence"
 * import * as S from "effect/Schema"
 * const value = LegacyEvidenceUnresolved.make({
 *   startChar: S.Natural.make(0), endChar: S.Natural.make(0), quote: "",
 *   confidence: Confidence.make(1)
 * })
 * console.log(value.reason)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class LegacyEvidenceUnresolved extends S.Opaque<LegacyEvidenceUnresolved, { readonly brand: unique symbol }>()(
  S.TaggedStruct("LegacyEvidenceUnresolved", {
    startChar: S.Natural,
    endChar: S.Natural,
    quote: S.String,
    confidence: Confidence,
    reason: S.tag("invalid-legacy-position"),
  }).pipe(
    $I.annoteSchema("LegacyEvidenceUnresolved", {
      description: "Frozen legacy position and numeric metadata requiring explicit repair before verification.",
    })
  )
) {}

/**
 * Source evidence with an independent extraction observation and explicit unresolved legacy imports.
 *
 * **Example** (Decode Evidence with span)
 *
 * ```ts
 * import { Evidence } from "@beep/epistemic-domain"
 * import * as Epistemic from "@beep/shared-domain/identity/Epistemic"
 * import * as S from "effect/Schema"
 *
 * const evidence = S.decodeUnknownSync(Evidence)({
 *   artifactFixtureKey: "artifact:oa-1",
 *   createdAt: 1,
 *   createdByPrincipal: { kind: "System", component: "Runtime" },
 *   entityType: Epistemic.EvidenceId.entityType,
 *   id: 1,
 *   orgId: 1,
 *   rowVersion: 1,
 *   schemaVersion: "0.0.0",
 *   source: "Agent",
 *   span: {
 *     version: "evidence-position/v2",
 *     position: { startChar: 12, endChar: 57, quote: "a processor configured to receive sensor data" },
 *     extractorConfidence: { _tag: "Absent", reason: "not-assessed" }
 *   },
 *   spanFixtureKey: "span:oa-1:12-57",
 *   updatedAt: 1,
 *   updatedByPrincipal: { kind: "System", component: "Runtime" }
 * })
 *
 * console.log(evidence.span)
 * ```
 *
 * @category entities
 * @since 0.0.0
 */
export class Evidence extends ProductEntity.Entity<Evidence>()(Epistemic.EvidenceId)(
  {
    artifactFixtureKey: EpistemicFixtureKey.annotateKey({
      description: "Stable fixture key for the source artifact.",
    }).pipe(pg.text(), pg.columnName("artifact_fixture_key")),
    spanFixtureKey: EpistemicFixtureKey.annotateKey({
      description: "Stable fixture key for the evidence span.",
    }).pipe(pg.text(), pg.columnName("span_fixture_key")),
    span: S.Union([EvidencePosition, LegacyEvidenceUnresolved])
      .annotateKey({
        description: "Char-offset evidence span persisted with the evidence row.",
      })
      .pipe(pg.jsonb()),
  },
  $I.annote("Evidence", {
    description: "Source span evidence reference.",
  })
) {}

/**
 * **Example** (Decode a frozen position row)
 *
 * ```ts
 * import { FrozenEvidencePosition } from "@beep/epistemic-domain/entities/Evidence"
 * import * as S from "effect/Schema"
 *
 * const decode = S.decodeUnknownEffect(FrozenEvidencePosition)
 * console.log(typeof decode)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FrozenEvidencePosition extends S.Opaque<FrozenEvidencePosition, { readonly brand: unique symbol }>()(
  S.Struct({
    confidence: Confidence,
    endChar: S.Natural,
    quote: S.String,
    startChar: S.Natural,
  }).pipe(
    $I.annoteSchema("FrozenEvidencePosition", {
      description: "Frozen pre-v2 evidence position payload, retaining inconsistent widths and empty quotes.",
    })
  )
) {}

/**
 * Persistence row whose span column declares every stored evidence position format.
 *
 * **Details**
 *
 * The domain read record is {@link Evidence}; table converters project this row into it, so the
 * physical JSON column is never derived from the current read schema alone.
 *
 * **Example** (Inspect the stored span column)
 *
 * ```ts
 * import { EvidenceRow } from "@beep/epistemic-domain/entities/Evidence"
 *
 * console.log(EvidenceRow.fields.span)
 * ```
 *
 * @category entities
 * @since 0.0.0
 */
export class EvidenceRow extends ProductEntity.Entity<EvidenceRow>()(Epistemic.EvidenceId)(
  {
    artifactFixtureKey: EpistemicFixtureKey.pipe(pg.text(), pg.columnName("artifact_fixture_key")),
    spanFixtureKey: EpistemicFixtureKey.pipe(pg.text(), pg.columnName("span_fixture_key")),
    span: S.Union([EvidencePosition, FrozenEvidencePosition]).pipe(
      $I.annoteSchema("StoredEvidencePosition", { description: "Current and frozen evidence JSON column formats." }),
      pg.jsonb()
    ),
  },
  $I.annote("EvidenceRow", { description: "Persistence row with explicitly versioned evidence column formats." })
) {}
