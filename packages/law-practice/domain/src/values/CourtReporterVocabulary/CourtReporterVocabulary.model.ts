/**
 * Public schemas for the pinned court and reporter vocabulary contract.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LawPracticeDomainId } from "@beep/identity/packages";
import { LiteralKit, NonNegativeInt, SchemaUtils } from "@beep/schema";
import * as Eq from "effect/Equal";
import * as S from "effect/Schema";

const $I = $LawPracticeDomainId.create("values/CourtReporterVocabulary/CourtReporterVocabulary.model");

/**
 * Stable public identity issued to one courts-db court.
 *
 * **Details**
 *
 * The current issuance preserves the pinned courts-db identifier. Compatibility
 * checks forbid reassignment or semantic reuse after publication.
 *
 * **Example** (Validate a court identity)
 *
 * ```ts
 * import { CourtId } from "@beep/law-practice-domain/values/CourtReporterVocabulary"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(CourtId)("cafc")) // true
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const CourtId = S.NonEmptyString.pipe(
  S.brand("CourtId"),
  $I.annoteSchema("CourtId", {
    description: "Stable public identity issued to one courts-db court.",
  })
);

/**
 * Decoded stable court identity.
 *
 * @see {@link CourtId} for runtime validation and identity semantics.
 * @category type-level
 * @since 0.0.0
 */
export type CourtId = typeof CourtId.Type;

/**
 * Stable public identity issued to one reporters-db record.
 *
 * **Details**
 *
 * The opaque value is derived from the initial source identity tuple. Future
 * aliases and lifecycle transitions retain the issued value.
 *
 * **Example** (Validate a reporter identity)
 *
 * ```ts
 * import { ReporterId } from "@beep/law-practice-domain/values/CourtReporterVocabulary"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ReporterId)("reporter:0123456789abcdef01234567")) // true
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const ReporterId = S.NonEmptyString.pipe(
  S.brand("ReporterId"),
  $I.annoteSchema("ReporterId", {
    description: "Stable opaque public identity issued to one reporters-db record.",
  })
);

/**
 * Decoded stable reporter identity.
 *
 * @see {@link ReporterId} for runtime validation and identity semantics.
 * @category type-level
 * @since 0.0.0
 */
export type ReporterId = typeof ReporterId.Type;

/**
 * Exact identifier for one combined pinned court/reporter artifact.
 *
 * **Example** (Validate an artifact identifier)
 *
 * ```ts
 * import { CourtReporterArtifactVersion } from "@beep/law-practice-domain/values/CourtReporterVocabulary"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(CourtReporterArtifactVersion)("crv1:f353e51400a5:fad63b383b92")) // true
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const CourtReporterArtifactVersion = S.NonEmptyString.pipe(
  S.brand("CourtReporterArtifactVersion"),
  $I.annoteSchema("CourtReporterArtifactVersion", {
    description: "Exact identifier for one combined pinned court/reporter artifact.",
  })
);

/**
 * Decoded combined artifact identifier.
 *
 * @see {@link CourtReporterArtifactVersion} for runtime validation.
 * @category type-level
 * @since 0.0.0
 */
export type CourtReporterArtifactVersion = typeof CourtReporterArtifactVersion.Type;

const CourtSystemBase = LiteralKit([
  "",
  "colonial",
  "extraterritorial",
  "federal",
  "international",
  "special",
  "state",
  "tribal",
]);

/**
 * Source-faithful courts-db `system` vocabulary at the pinned commit.
 *
 * **Gotchas**
 *
 * The empty string is an upstream value and remains distinct from a missing
 * value. This schema does not collapse it into the existing lossy
 * `CourtJurisdiction` projection.
 *
 * **Example** (Inspect the federal source value)
 *
 * ```ts
 * import { CourtSystem } from "@beep/law-practice-domain/values/CourtReporterVocabulary"
 *
 * console.log(CourtSystem.is.federal("federal")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CourtSystem = CourtSystemBase.pipe(
  $I.annoteSchema("CourtSystem", {
    description: "Source-faithful courts-db system vocabulary at the pinned commit.",
  }),
  SchemaUtils.withLiteralKitStatics(CourtSystemBase)
);

/**
 * Decoded courts-db system literal.
 *
 * @see {@link CourtSystem} for the exact pinned domain.
 * @category type-level
 * @since 0.0.0
 */
export type CourtSystem = typeof CourtSystem.Type;

const CourtTypeBase = LiteralKit([
  "",
  "ag",
  "appellate",
  "bankruptcy",
  "international",
  "special",
  "trial",
  "trial & iac",
]);

/**
 * Source-faithful non-null courts-db `type` vocabulary at the pinned commit.
 *
 * **Example** (Inspect the appellate source value)
 *
 * ```ts
 * import { CourtType } from "@beep/law-practice-domain/values/CourtReporterVocabulary"
 *
 * console.log(CourtType.is.appellate("appellate")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CourtType = CourtTypeBase.pipe(
  $I.annoteSchema("CourtType", {
    description: "Source-faithful non-null courts-db type vocabulary at the pinned commit.",
  }),
  SchemaUtils.withLiteralKitStatics(CourtTypeBase)
);

/**
 * Decoded non-null courts-db court type.
 *
 * @see {@link CourtType} for the exact pinned domain.
 * @category type-level
 * @since 0.0.0
 */
export type CourtType = typeof CourtType.Type;

const CourtHierarchyLevelBase = LiteralKit(["", "colr", "gjc", "gjc & iac", "iac", "ljc", "trial"]);

/**
 * Source-faithful non-null courts-db `level` vocabulary.
 *
 * **Details**
 *
 * The collision-free name keeps this richer upstream dimension separate from
 * the existing lossy `CourtLevel` citation inference.
 *
 * **Example** (Inspect the court-of-last-resort value)
 *
 * ```ts
 * import { CourtHierarchyLevel } from "@beep/law-practice-domain/values/CourtReporterVocabulary"
 *
 * console.log(CourtHierarchyLevel.is.colr("colr")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CourtHierarchyLevel = CourtHierarchyLevelBase.pipe(
  $I.annoteSchema("CourtHierarchyLevel", {
    description: "Source-faithful non-null courts-db hierarchy level vocabulary.",
  }),
  SchemaUtils.withLiteralKitStatics(CourtHierarchyLevelBase)
);

/**
 * Decoded non-null courts-db hierarchy level.
 *
 * @see {@link CourtHierarchyLevel} for the collision-free source vocabulary.
 * @category type-level
 * @since 0.0.0
 */
export type CourtHierarchyLevel = typeof CourtHierarchyLevel.Type;

const ReporterCiteTypeBase = LiteralKit([
  "federal",
  "neutral",
  "scotus_early",
  "specialty",
  "specialty_lexis",
  "specialty_west",
  "state",
  "state_regional",
]);

/**
 * Canonical reporters-db string `cite_type` vocabulary.
 *
 * **Gotchas**
 *
 * CourtListener integer citation types are not decode authority for this
 * schema. Any later interop mapping must be a separate pinned projection.
 *
 * **Example** (Inspect the regional reporter type)
 *
 * ```ts
 * import { ReporterCiteType } from "@beep/law-practice-domain/values/CourtReporterVocabulary"
 *
 * console.log(ReporterCiteType.is.state_regional("state_regional")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ReporterCiteType = ReporterCiteTypeBase.pipe(
  $I.annoteSchema("ReporterCiteType", {
    description: "Canonical reporters-db string cite_type vocabulary.",
  }),
  SchemaUtils.withLiteralKitStatics(ReporterCiteTypeBase)
);

/**
 * Decoded canonical reporters-db citation type.
 *
 * @see {@link ReporterCiteType} for the source-authoritative string domain.
 * @category type-level
 * @since 0.0.0
 */
export type ReporterCiteType = typeof ReporterCiteType.Type;

const VocabularyEntryStatusBase = LiteralKit(["active", "tombstone"]);

/**
 * Lifecycle state retained on every issued vocabulary identity.
 *
 * **Example** (Identify a tombstone)
 *
 * ```ts
 * import { VocabularyEntryStatus } from "@beep/law-practice-domain/values/CourtReporterVocabulary"
 *
 * console.log(VocabularyEntryStatus.is.tombstone("tombstone")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const VocabularyEntryStatus = VocabularyEntryStatusBase.pipe(
  $I.annoteSchema("VocabularyEntryStatus", {
    description: "Lifecycle state retained on every issued vocabulary identity.",
  }),
  SchemaUtils.withLiteralKitStatics(VocabularyEntryStatusBase)
);

/**
 * Decoded vocabulary identity lifecycle state.
 *
 * @see {@link VocabularyEntryStatus} for the active and tombstone states.
 * @category type-level
 * @since 0.0.0
 */
export type VocabularyEntryStatus = typeof VocabularyEntryStatus.Type;

const ArtifactCompatibilityStatusBase = LiteralKit(["compatible", "incompatible"]);

/**
 * Compatibility verdict between two court/reporter artifacts.
 *
 * **Example** (Inspect an incompatible verdict)
 *
 * ```ts
 * import { ArtifactCompatibilityStatus } from "@beep/law-practice-domain/values/CourtReporterVocabulary"
 *
 * console.log(ArtifactCompatibilityStatus.is.incompatible("incompatible")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ArtifactCompatibilityStatus = ArtifactCompatibilityStatusBase.pipe(
  $I.annoteSchema("ArtifactCompatibilityStatus", {
    description: "Compatibility verdict between two court/reporter artifacts.",
  }),
  SchemaUtils.withLiteralKitStatics(ArtifactCompatibilityStatusBase)
);

/**
 * Decoded artifact compatibility verdict.
 *
 * @see {@link ArtifactCompatibilityStatus} for the finite verdict domain.
 * @category type-level
 * @since 0.0.0
 */
export type ArtifactCompatibilityStatus = typeof ArtifactCompatibilityStatus.Type;

const ArtifactDriftChangeKindBase = LiteralKit([
  "addition",
  "aliasAddition",
  "aliasRemoval",
  "tombstone",
  "successor",
  "successorRemoval",
  "merger",
  "abbreviationReuse",
  "dateSplit",
  "idReassignment",
  "semanticReuse",
  "removalWithoutTombstone",
  "schemaChange",
  "projectionChange",
]);

/**
 * Exhaustive change classes emitted by the compatibility classifier.
 *
 * **Example** (Inspect the date-split class)
 *
 * ```ts
 * import { ArtifactDriftChangeKind } from "@beep/law-practice-domain/values/CourtReporterVocabulary"
 *
 * console.log(ArtifactDriftChangeKind.is.dateSplit("dateSplit")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ArtifactDriftChangeKind = ArtifactDriftChangeKindBase.pipe(
  $I.annoteSchema("ArtifactDriftChangeKind", {
    description: "Exhaustive change classes emitted by the court/reporter compatibility classifier.",
  }),
  SchemaUtils.withLiteralKitStatics(ArtifactDriftChangeKindBase)
);

/**
 * Decoded artifact drift change class.
 *
 * @see {@link ArtifactDriftChangeKind} for every reviewable change class.
 * @category type-level
 * @since 0.0.0
 */
export type ArtifactDriftChangeKind = typeof ArtifactDriftChangeKind.Type;

const ArtifactSubjectKind = LiteralKit(["artifact", "court", "reporter"]).pipe(
  $I.annoteSchema("ArtifactSubjectKind", {
    description: "Subject family named by a compatibility change.",
  })
);

/**
 * An alias whose text maps to more than one stable identity.
 *
 * **Example** (Keep abbreviation context)
 *
 * ```ts
 * import { ContextualAlias } from "@beep/law-practice-domain/values/CourtReporterVocabulary"
 *
 * console.log(ContextualAlias.make({ alias: "Rob.", context: "Virginia Reports" }).context)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ContextualAlias extends S.Class<ContextualAlias>($I`ContextualAlias`)(
  {
    alias: S.NonEmptyString,
    context: S.NonEmptyString,
  },
  $I.annote("ContextualAlias", {
    description: "An alias whose text maps to more than one stable identity and therefore requires context.",
  })
) {}

/**
 * Inclusive source effective range with independently optional endpoints.
 *
 * **Example** (Represent an open-ended range)
 *
 * ```ts
 * import { EffectiveRange } from "@beep/law-practice-domain/values/CourtReporterVocabulary"
 * import * as O from "effect/Option"
 *
 * console.log(O.isNone(EffectiveRange.make({ start: O.some("2020-01-01"), end: O.none() }).end)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EffectiveRange extends S.Class<EffectiveRange>($I`EffectiveRange`)(
  {
    start: S.OptionFromNullOr(S.String),
    end: S.OptionFromNullOr(S.String),
  },
  $I.annote("EffectiveRange", {
    description: "Inclusive source effective range with independently optional endpoints.",
  })
) {}

/**
 * Public source-faithful court vocabulary record without resolver regex data.
 *
 * **Example** (Inspect the court record schema)
 *
 * ```ts
 * import { CourtVocabularyRecord } from "@beep/law-practice-domain/values/CourtReporterVocabulary"
 *
 * console.log("id" in CourtVocabularyRecord.fields) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CourtVocabularyRecord extends S.Class<CourtVocabularyRecord>($I`CourtVocabularyRecord`)(
  {
    id: CourtId,
    sourceId: S.NonEmptyString,
    semanticKey: S.NonEmptyString,
    lineageKey: S.NonEmptyString,
    name: S.NonEmptyString,
    nameAbbreviation: S.OptionFromNullOr(S.String),
    citationString: S.String,
    sourceJurisdiction: S.OptionFromNullOr(S.String),
    system: CourtSystem,
    type: S.OptionFromNullOr(CourtType),
    hierarchyLevel: S.OptionFromNullOr(CourtHierarchyLevel),
    location: S.String,
    parentId: S.OptionFromNullOr(CourtId),
    effectiveRanges: S.Array(EffectiveRange),
    aliases: S.Array(S.NonEmptyString),
    contextualAliases: S.Array(ContextualAlias),
    status: VocabularyEntryStatus,
    successorId: S.OptionFromNullOr(CourtId),
  },
  $I.annote("CourtVocabularyRecord", {
    description:
      "Public source-faithful court vocabulary record with stable identity, lifecycle, aliases, and resolver-private fields omitted.",
  })
) {}

/**
 * One named reporters-db edition and its effective range.
 *
 * **Example** (Inspect the reporter edition schema)
 *
 * ```ts
 * import { ReporterEdition } from "@beep/law-practice-domain/values/CourtReporterVocabulary"
 *
 * console.log("abbreviation" in ReporterEdition.fields) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ReporterEdition extends S.Class<ReporterEdition>($I`ReporterEdition`)(
  {
    abbreviation: S.NonEmptyString,
    start: S.OptionFromNullOr(S.String),
    end: S.OptionFromNullOr(S.String),
  },
  $I.annote("ReporterEdition", {
    description: "One named reporters-db edition and its effective range.",
  })
) {}

/**
 * Public reporters-db vocabulary record with a stable identity.
 *
 * **Example** (Inspect the reporter record schema)
 *
 * ```ts
 * import { ReporterVocabularyRecord } from "@beep/law-practice-domain/values/CourtReporterVocabulary"
 *
 * console.log("citeType" in ReporterVocabularyRecord.fields) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ReporterVocabularyRecord extends S.Class<ReporterVocabularyRecord>($I`ReporterVocabularyRecord`)(
  {
    id: ReporterId,
    semanticKey: S.NonEmptyString,
    lineageKey: S.NonEmptyString,
    primaryAbbreviation: S.NonEmptyString,
    name: S.NonEmptyString,
    citeType: ReporterCiteType,
    editions: S.Array(ReporterEdition),
    jurisdictions: S.Array(S.String),
    aliases: S.Array(S.NonEmptyString),
    contextualAliases: S.Array(ContextualAlias),
    status: VocabularyEntryStatus,
    successorId: S.OptionFromNullOr(ReporterId),
  },
  $I.annote("ReporterVocabularyRecord", {
    description:
      "Public reporters-db vocabulary record with stable identity, canonical cite type, editions, aliases, and lifecycle.",
  })
) {}

const SourceRepository = LiteralKit(["courts-db", "reporters-db"]).pipe(
  $I.annoteSchema("SourceRepository", {
    description: "Pinned Free Law Project repository represented by one vocabulary projection.",
  })
);

/**
 * Pinned source identity and regeneration metadata for one projection.
 *
 * **Example** (Inspect provenance fields)
 *
 * ```ts
 * import { VocabularySourceProvenance } from "@beep/law-practice-domain/values/CourtReporterVocabulary"
 *
 * console.log("sha256" in VocabularySourceProvenance.fields) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class VocabularySourceProvenance extends S.Class<VocabularySourceProvenance>($I`VocabularySourceProvenance`)(
  {
    repository: SourceRepository,
    release: S.NonEmptyString,
    commit: S.NonEmptyString,
    retrievedOn: S.NonEmptyString,
    sourceUrl: S.NonEmptyString,
    sha256: S.NonEmptyString,
    semanticSha256: S.OptionFromNullOr(S.NonEmptyString),
    refreshCommand: S.NonEmptyString,
  },
  $I.annote("VocabularySourceProvenance", {
    description: "Pinned source identity and regeneration metadata for one court or reporter projection.",
  })
) {}

const schemaVersion = S.Literal("court-reporter-vocabulary/v1");
const projectionVersion = S.Literal(1);

/**
 * Machine-readable courts-db vocabulary projection.
 *
 * **Example** (Inspect stable-ID count field)
 *
 * ```ts
 * import { CourtVocabularyArtifact } from "@beep/law-practice-domain/values/CourtReporterVocabulary"
 *
 * console.log("stableIdCount" in CourtVocabularyArtifact.fields) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CourtVocabularyArtifact extends S.Class<CourtVocabularyArtifact>($I`CourtVocabularyArtifact`)(
  {
    schemaVersion,
    projectionVersion,
    artifactVersion: CourtReporterArtifactVersion,
    source: VocabularySourceProvenance,
    stableIdCount: NonNegativeInt,
    records: S.Array(CourtVocabularyRecord),
  },
  $I.annote("CourtVocabularyArtifact", {
    description: "Machine-readable courts-db vocabulary projection with stable IDs and provenance.",
  })
) {}

/**
 * Machine-readable reporters-db vocabulary projection.
 *
 * **Example** (Inspect stable-ID count field)
 *
 * ```ts
 * import { ReporterVocabularyArtifact } from "@beep/law-practice-domain/values/CourtReporterVocabulary"
 *
 * console.log("stableIdCount" in ReporterVocabularyArtifact.fields) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ReporterVocabularyArtifact extends S.Class<ReporterVocabularyArtifact>($I`ReporterVocabularyArtifact`)(
  {
    schemaVersion,
    projectionVersion,
    artifactVersion: CourtReporterArtifactVersion,
    source: VocabularySourceProvenance,
    stableIdCount: NonNegativeInt,
    records: S.Array(ReporterVocabularyRecord),
  },
  $I.annote("ReporterVocabularyArtifact", {
    description: "Machine-readable reporters-db vocabulary projection with stable IDs and provenance.",
  })
) {}

/**
 * Compatibility policy carried by the combined artifact contract.
 *
 * **Example** (Inspect compatible change rules)
 *
 * ```ts
 * import { ArtifactCompatibilityPolicy } from "@beep/law-practice-domain/values/CourtReporterVocabulary"
 *
 * console.log("compatibleChanges" in ArtifactCompatibilityPolicy.fields) // true
 * ```
 *
 * @category policies
 * @since 0.0.0
 */
export class ArtifactCompatibilityPolicy extends S.Class<ArtifactCompatibilityPolicy>($I`ArtifactCompatibilityPolicy`)(
  {
    compatibleChanges: S.Array(ArtifactDriftChangeKind),
    incompatibleChanges: S.Array(ArtifactDriftChangeKind),
  },
  $I.annote("ArtifactCompatibilityPolicy", {
    description: "Machine-readable partition of additive-safe and identity/schema-breaking artifact changes.",
  })
) {}

const CourtReporterArtifactVersionCoherenceCheck = S.makeFilter(
  (artifact: {
    readonly artifactVersion: CourtReporterArtifactVersion;
    readonly courts: { readonly artifactVersion: CourtReporterArtifactVersion };
    readonly reporters: { readonly artifactVersion: CourtReporterArtifactVersion };
  }) =>
    Eq.equals(artifact.artifactVersion, artifact.courts.artifactVersion) &&
    Eq.equals(artifact.artifactVersion, artifact.reporters.artifactVersion),
  {
    identifier: $I`CourtReporterArtifactVersionCoherenceCheck`,
    title: "Court Reporter Artifact Version Coherence",
    description: "The combined contract and both independently generated vocabularies must name one artifact version.",
    message: "Court and reporter vocabularies must match the combined artifact version",
  }
);

/**
 * One combined versioned court/reporter compatibility contract.
 *
 * **Example** (Inspect contract fields)
 *
 * ```ts
 * import { CourtReporterArtifactContract } from "@beep/law-practice-domain/values/CourtReporterVocabulary"
 *
 * console.log("artifactVersion" in CourtReporterArtifactContract.fields) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CourtReporterArtifactContract extends S.Class<CourtReporterArtifactContract>(
  $I`CourtReporterArtifactContract`
)(
  S.Struct({
    schemaVersion,
    projectionVersion,
    artifactVersion: CourtReporterArtifactVersion,
    policy: ArtifactCompatibilityPolicy,
    courts: CourtVocabularyArtifact,
    reporters: ReporterVocabularyArtifact,
  }).check(CourtReporterArtifactVersionCoherenceCheck),
  $I.annote("CourtReporterArtifactContract", {
    description:
      "Combined exact-version court/reporter artifact plus its machine-readable lifecycle compatibility policy.",
  })
) {}

class CourtVocabularyArtifactComparison extends S.Class<CourtVocabularyArtifactComparison>(
  $I`CourtVocabularyArtifactComparison`
)(
  {
    schemaVersion: S.NonEmptyString,
    projectionVersion: S.Finite,
    artifactVersion: CourtReporterArtifactVersion,
    source: VocabularySourceProvenance,
    stableIdCount: NonNegativeInt,
    records: S.Array(CourtVocabularyRecord),
  },
  $I.annote("CourtVocabularyArtifactComparison", {
    description: "Court vocabulary accepted for cross-version review before compatibility classification.",
  })
) {}

class ReporterVocabularyArtifactComparison extends S.Class<ReporterVocabularyArtifactComparison>(
  $I`ReporterVocabularyArtifactComparison`
)(
  {
    schemaVersion: S.NonEmptyString,
    projectionVersion: S.Finite,
    artifactVersion: CourtReporterArtifactVersion,
    source: VocabularySourceProvenance,
    stableIdCount: NonNegativeInt,
    records: S.Array(ReporterVocabularyRecord),
  },
  $I.annote("ReporterVocabularyArtifactComparison", {
    description: "Reporter vocabulary accepted for cross-version review before compatibility classification.",
  })
) {}

/**
 * Artifact shape accepted by cross-version compatibility review.
 *
 * **Details**
 *
 * Unlike the current runtime contract, the header fields are intentionally
 * open so a future schema or projection revision can be classified as an
 * incompatible change instead of failing before review.
 *
 * **Example** (Prepare the current artifact for comparison)
 *
 * ```ts
 * import {
 *   CourtReporterArtifact,
 *   CourtReporterArtifactComparison,
 * } from "@beep/law-practice-domain/values/CourtReporterVocabulary"
 *
 * const comparable = CourtReporterArtifactComparison.make(CourtReporterArtifact)
 * console.log(comparable.schemaVersion) // "court-reporter-vocabulary/v1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CourtReporterArtifactComparison extends S.Class<CourtReporterArtifactComparison>(
  $I`CourtReporterArtifactComparison`
)(
  S.Struct({
    schemaVersion: S.NonEmptyString,
    projectionVersion: S.Finite,
    artifactVersion: CourtReporterArtifactVersion,
    policy: ArtifactCompatibilityPolicy,
    courts: CourtVocabularyArtifactComparison,
    reporters: ReporterVocabularyArtifactComparison,
  }).check(CourtReporterArtifactVersionCoherenceCheck),
  $I.annote("CourtReporterArtifactComparison", {
    description: "Cross-version comparison input with open schema and projection header fields.",
  })
) {}

/**
 * One reviewable lifecycle or compatibility change.
 *
 * **Example** (Construct an addition row)
 *
 * ```ts
 * import { ArtifactDriftChange } from "@beep/law-practice-domain/values/CourtReporterVocabulary"
 *
 * const change = ArtifactDriftChange.make({
 *   kind: "addition",
 *   compatibility: "compatible",
 *   subjectKind: "court",
 *   subjectIds: ["cafc"],
 *   detail: "Court identity added.",
 * })
 * console.log(change.kind) // "addition"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ArtifactDriftChange extends S.Class<ArtifactDriftChange>($I`ArtifactDriftChange`)(
  {
    kind: ArtifactDriftChangeKind,
    compatibility: ArtifactCompatibilityStatus,
    subjectKind: ArtifactSubjectKind,
    subjectIds: S.Array(S.NonEmptyString),
    detail: S.NonEmptyString,
  },
  $I.annote("ArtifactDriftChange", {
    description: "One reviewable lifecycle or compatibility change between court/reporter artifacts.",
  })
) {}

/**
 * Complete compatibility report between two exact artifact versions.
 *
 * **Example** (Inspect report fields)
 *
 * ```ts
 * import { ArtifactDriftReport } from "@beep/law-practice-domain/values/CourtReporterVocabulary"
 *
 * console.log("changes" in ArtifactDriftReport.fields) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ArtifactDriftReport extends S.Class<ArtifactDriftReport>($I`ArtifactDriftReport`)(
  {
    fromVersion: CourtReporterArtifactVersion,
    toVersion: CourtReporterArtifactVersion,
    compatibility: ArtifactCompatibilityStatus,
    changes: S.Array(ArtifactDriftChange),
  },
  $I.annote("ArtifactDriftReport", {
    description: "Complete reviewable compatibility report between two exact court/reporter artifact versions.",
  })
) {}
