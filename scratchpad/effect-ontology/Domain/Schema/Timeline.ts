/**
 * Bitemporal timeline, correction-history, and conflict-query contracts.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import { IRI } from "@beep/rdf";
import { LiteralKit, NonNegativeInt, PosInt, SchemaUtils } from "@beep/schema";
import { SchemaGetter } from "effect";
import * as DateTime from "effect/DateTime";
import * as S from "effect/Schema";
import { OptionalConfidence } from "../Model/shared.ts";
import { ClaimId, ClaimRank, RdfObject, TextSpan } from "./KnowledgeModel.ts";

const $I = $ScratchpadId.create("effect-ontology/Domain/Schema/Timeline");

/**
 * Claim-rank vocabulary re-exported for timeline source-path parity.
 *
 * **Example** (Use BooleanQueryValueDefinition)
 * ```ts
 * import { ClaimRank } from "@effect-ontology/Schema/Timeline.ts"
 *
 * console.log(ClaimRank.is.preferred("preferred")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export { ClaimRank };

const BooleanQueryValueDefinition = LiteralKit(["true", "false", "1", "0"]).pipe(
  S.decodeTo(S.Boolean, {
    decode: SchemaGetter.transform((value) => value === "true" || value === "1"),
    encode: SchemaGetter.transform((value) => (value ? "true" : "false")),
  })
);

const BooleanQueryValue = BooleanQueryValueDefinition.annotate({
  toArbitrary: () => (fc) => fc.boolean(),
}).pipe(
  $I.annoteSchema("BooleanQueryValue", {
    description: "Boolean URL-query codec accepting true, false, 1, or 0 and encoding canonically as true or false.",
  })
);

const NonNegativeIntQuery = S.FiniteFromString.pipe(
  S.decodeTo(NonNegativeInt, {
    decode: SchemaGetter.transform(NonNegativeInt.make),
    encode: SchemaGetter.transform((value): number => value),
  }),
  $I.annoteSchema("NonNegativeIntQuery", {
    description: "URL-query string decoded to a finite non-negative integer.",
  })
);

const PositiveIntQuery = S.FiniteFromString.pipe(
  S.decodeTo(PosInt, {
    decode: SchemaGetter.transform(PosInt.make),
    encode: SchemaGetter.transform((value): number => value),
  }),
  $I.annoteSchema("PositiveIntQuery", {
    description: "URL-query string decoded to a finite positive integer.",
  })
);

const TimelineRangeFields = S.Struct({
  from: S.DateTimeUtcFromString.annotateKey({
    description: "Inclusive UTC range start.",
  }),
  to: S.DateTimeUtcFromString.annotateKey({
    description: "Inclusive UTC range end.",
  }),
});

const TimelineRangeDefinition = TimelineRangeFields.check(
  S.makeFilter(
    (range) =>
      DateTime.toEpochMillis(range.from) <= DateTime.toEpochMillis(range.to)
        ? undefined
        : {
            path: ["to"],
            issue: "Timeline range end must not precede its start.",
          },
    {
      identifier: $I`TimelineRangeOrderCheck`,
      title: "Ordered Timeline Range",
      description: "A UTC query range whose end is not before its start.",
      message: "Timeline range end must be greater than or equal to its start.",
    }
  )
);

const TimelineRangeFromSelf = S.declare((input: unknown): input is typeof TimelineRangeDefinition.Type =>
  S.is(TimelineRangeDefinition)(input)
).annotate({
  toArbitrary: () => (fc) =>
    fc
      .tuple(fc.integer({ min: 0, max: 4_000_000_000_000 }), fc.integer({ min: 0, max: 86_400_000 }))
      .map(([from, duration]) =>
        TimelineRangeFields.make({
          from: S.decodeSync(S.DateTimeUtcFromMillis)(from),
          to: S.decodeSync(S.DateTimeUtcFromMillis)(from + duration),
        })
      ),
});

const TimelineRange = TimelineRangeDefinition.pipe(
  S.decodeTo(TimelineRangeFromSelf),
  $I.annoteSchema("TimelineRange", {
    description: "Ordered UTC range used by timeline queries.",
  })
);

const TimelineRangeQuery = S.fromJsonString(TimelineRangeDefinition).pipe(
  $I.annoteSchema("TimelineRangeQuery", {
    description: "JSON-encoded ordered UTC range accepted in a URL-query value.",
  })
);

/**
 * Compact source-article projection used for timeline attribution.
 *
 * **Example** (Use ArticleSummary)
 * ```ts
 * import { ArticleSummary } from "@effect-ontology/Schema/Timeline.ts"
 *
 * const article = ArticleSummary.fromUnknown({
 *   id: "article-42",
 *   uri: "https://example.com/news/42",
 *   publishedAt: "2026-07-25T10:00:00.000Z",
 *   ingestedAt: "2026-07-25T10:05:00.000Z"
 * })
 * console.log(article.id) // "article-42"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ArticleSummary extends S.Class<ArticleSummary>($I`ArticleSummary`)(
  {
    id: S.NonEmptyString.annotateKey({ description: "Persistent article identifier." }),
    uri: IRI.annotateKey({ description: "Canonical source resource IRI." }),
    headline: S.OptionFromNullishOr(S.NonEmptyString).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({ description: "Optional non-empty article headline." })
    ),
    sourceName: S.OptionFromNullishOr(S.NonEmptyString).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({ description: "Optional publisher or source name." })
    ),
    publishedAt: S.DateTimeUtcFromString.annotateKey({
      description: "UTC source publication instant.",
    }),
    ingestedAt: S.DateTimeUtcFromString.annotateKey({
      description: "UTC system-ingestion instant.",
    }),
  },
  $I.annote("ArticleSummary", {
    description: "Source-article attribution with validated IRI and UTC transaction timestamps.",
  })
) {
  static readonly is = S.is(ArticleSummary);
  static readonly fromUnknown = S.decodeUnknownSync(ArticleSummary);
}

/**
 * Claim projection enriched for bitemporal timeline queries.
 *
 * **Details**
 *
 * * Valid-world time and knowledge-base transaction time are nested separately.
 * The RDF object keeps its canonical term discriminator, and missing
 * confidence or evidence is normalized to `Option`.
 *
 * **Example** (Use ClaimWithRank)
 * ```ts
 * import type { ClaimWithRank } from "@effect-ontology/Schema/Timeline.ts"
 *
 * const readRank = (claim: ClaimWithRank) => claim.rank
 * console.log(readRank)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ClaimWithRank extends S.Class<ClaimWithRank>($I`ClaimWithRank`)(
  {
    id: ClaimId,
    subject: IRI,
    predicate: IRI,
    object: RdfObject,
    rank: ClaimRank,
    source: ArticleSummary,
    validTime: S.OptionFromOptionalKey(TimelineRange).pipe(SchemaUtils.withNoneDefault),
    transactionTime: S.Struct({
      assertedAt: S.DateTimeUtcFromString,
      derivedAt: S.OptionFromNullishOr(S.DateTimeUtcFromString).pipe(SchemaUtils.withNoneDefault),
      deprecatedAt: S.OptionFromNullishOr(S.DateTimeUtcFromString).pipe(SchemaUtils.withNoneDefault),
    }),
    confidence: OptionalConfidence,
    evidence: S.OptionFromNullishOr(TextSpan).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("ClaimWithRank", {
    description:
      "Ranked claim projection with canonical RDF object, source attribution, and separated bitemporal data.",
  })
) {
  static readonly is = S.is(ClaimWithRank);
}

/**
 * Compact record of one claim correction or supersession.
 *
 * **Example** (Use CorrectionSummary)
 * ```ts
 * import { CorrectionSummary } from "@effect-ontology/Schema/Timeline.ts"
 *
 * const correction = CorrectionSummary.fromUnknown({
 *   id: "correction-42",
 *   correctionType: "superseded",
 *   correctionDate: "2026-07-25T12:00:00.000Z",
 *   originalClaimId: "claim-abc123def456"
 * })
 * console.log(correction.correctionType) // "superseded"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CorrectionSummary extends S.Class<CorrectionSummary>($I`CorrectionSummary`)(
  {
    id: S.NonEmptyString,
    correctionType: S.NonEmptyString,
    reason: S.OptionFromNullishOr(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault),
    correctionDate: S.DateTimeUtcFromString,
    originalClaimId: ClaimId,
    newClaimId: S.OptionFromNullishOr(ClaimId).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("CorrectionSummary", {
    description: "Compact correction record linking an original claim to an optional replacement.",
  })
) {
  static readonly fromUnknown = S.decodeUnknownSync(CorrectionSummary);
}

/**
 * Article detail response with its timeline claims and aggregate counts.
 *
 * **Example** (Use ArticleDetailResponse)
 * ```ts
 * import { ArticleDetailResponse } from "@effect-ontology/Schema/Timeline.ts"
 *
 * const countClaims = (response: ArticleDetailResponse) => response.claims.length
 * console.log(countClaims)
 * ```
 *
 * @category dtos
 * @since 0.0.0
 */
export class ArticleDetailResponse extends S.Class<ArticleDetailResponse>($I`ArticleDetailResponse`)(
  {
    article: ArticleSummary,
    claims: S.Array(ClaimWithRank).pipe(SchemaUtils.withEmptyArrayDefaults<ClaimWithRank>()),
    entityCount: NonNegativeInt,
    conflictCount: NonNegativeInt,
  },
  $I.annote("ArticleDetailResponse", {
    description: "Detailed source article with ranked claims and non-negative entity and conflict counts.",
  })
) {}

/**
 * Query for one entity's timeline state.
 *
 * **Example** (Use TimelineEntityQuery)
 * ```ts
 * import { TimelineEntityQuery } from "@effect-ontology/Schema/Timeline.ts"
 *
 * const query = TimelineEntityQuery.fromUnknown({})
 * console.log(query.includeDeprecated) // false
 * ```
 *
 * @category dtos
 * @since 0.0.0
 */
export class TimelineEntityQuery extends S.Class<TimelineEntityQuery>($I`TimelineEntityQuery`)(
  {
    asOf: S.OptionFromOptionalKey(S.DateTimeUtcFromString).pipe(SchemaUtils.withNoneDefault),
    range: S.OptionFromOptionalKey(TimelineRangeQuery).pipe(SchemaUtils.withNoneDefault),
    includeDeprecated: BooleanQueryValue.pipe(SchemaUtils.withKeyDefaults(false)),
  },
  $I.annote("TimelineEntityQuery", {
    description: "Entity-timeline query with optional UTC snapshot/range and a false deprecated-claim default.",
  })
) {
  static readonly fromUnknown = S.decodeUnknownSync(TimelineEntityQuery);
}

/**
 * Timeline response for one entity IRI.
 *
 * **Example** (Use TimelineEntityResponse)
 * ```ts
 * import type { TimelineEntityResponse } from "@effect-ontology/Schema/Timeline.ts"
 *
 * const countCorrections = (response: TimelineEntityResponse) => response.corrections.length
 * console.log(countCorrections)
 * ```
 *
 * @category dtos
 * @since 0.0.0
 */
export class TimelineEntityResponse extends S.Class<TimelineEntityResponse>($I`TimelineEntityResponse`)(
  {
    iri: IRI,
    asOf: S.OptionFromNullishOr(S.DateTimeUtcFromString).pipe(SchemaUtils.withNoneDefault),
    claims: S.Array(ClaimWithRank).pipe(SchemaUtils.withEmptyArrayDefaults<ClaimWithRank>()),
    corrections: S.Array(CorrectionSummary).pipe(SchemaUtils.withEmptyArrayDefaults<CorrectionSummary>()),
  },
  $I.annote("TimelineEntityResponse", {
    description: "Entity timeline state with normalized snapshot time, claims, and correction history.",
  })
) {}

/**
 * Filter and pagination query for timeline claims.
 *
 * **Example** (Use TimelineClaimsQuery)
 * ```ts
 * import { TimelineClaimsQuery } from "@effect-ontology/Schema/Timeline.ts"
 *
 * const query = TimelineClaimsQuery.fromUnknown({})
 * console.log(query.limit) // 20
 * ```
 *
 * @category dtos
 * @since 0.0.0
 */
export class TimelineClaimsQuery extends S.Class<TimelineClaimsQuery>($I`TimelineClaimsQuery`)(
  {
    subject: S.OptionFromOptionalKey(IRI).pipe(SchemaUtils.withNoneDefault),
    predicate: S.OptionFromOptionalKey(IRI).pipe(SchemaUtils.withNoneDefault),
    asOf: S.OptionFromOptionalKey(S.DateTimeUtcFromString).pipe(SchemaUtils.withNoneDefault),
    source: S.OptionFromOptionalKey(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault),
    rank: S.OptionFromOptionalKey(ClaimRank).pipe(SchemaUtils.withNoneDefault),
    limit: PositiveIntQuery.pipe(SchemaUtils.withKeyDefaults(PosInt.make(20))),
    offset: NonNegativeIntQuery.pipe(SchemaUtils.withKeyDefaults(NonNegativeInt.make(0))),
  },
  $I.annote("TimelineClaimsQuery", {
    description: "Timeline-claim filters with Option-normalized criteria and constrained pagination defaults.",
  })
) {
  static readonly fromUnknown = S.decodeUnknownSync(TimelineClaimsQuery);
}

/**
 * Paginated response containing timeline claims.
 *
 * **Example** (Use TimelineClaimsResponse)
 * ```ts
 * import type { TimelineClaimsResponse } from "@effect-ontology/Schema/Timeline.ts"
 *
 * const hasNext = (response: TimelineClaimsResponse) => response.hasMore
 * console.log(hasNext)
 * ```
 *
 * @category dtos
 * @since 0.0.0
 */
export class TimelineClaimsResponse extends S.Class<TimelineClaimsResponse>($I`TimelineClaimsResponse`)(
  {
    claims: S.Array(ClaimWithRank).pipe(SchemaUtils.withEmptyArrayDefaults<ClaimWithRank>()),
    total: NonNegativeInt,
    limit: PosInt,
    offset: NonNegativeInt,
    hasMore: S.Boolean,
  },
  $I.annote("TimelineClaimsResponse", {
    description: "Paginated ranked-claim response with constrained counts and offsets.",
  })
) {}

/**
 * Correction-history query controls.
 *
 * **Example** (Use CorrectionHistoryQuery)
 * ```ts
 * import { CorrectionHistoryQuery } from "@effect-ontology/Schema/Timeline.ts"
 *
 * console.log(CorrectionHistoryQuery.make({}).includeOriginalClaims) // false
 * ```
 *
 * @category dtos
 * @since 0.0.0
 */
export class CorrectionHistoryQuery extends S.Class<CorrectionHistoryQuery>($I`CorrectionHistoryQuery`)(
  {
    includeOriginalClaims: S.Boolean.pipe(SchemaUtils.withKeyDefaults(false)),
  },
  $I.annote("CorrectionHistoryQuery", {
    description: "Correction-history controls with an explicit false original-claim default.",
  })
) {}

const AffectedClaim = S.Struct({
  originalClaim: ClaimWithRank,
  newClaim: S.OptionFromNullishOr(ClaimWithRank).pipe(SchemaUtils.withNoneDefault),
});

/**
 * Full correction record and the claims it affected.
 *
 * **Example** (Use CorrectionWithClaims)
 * ```ts
 * import type { CorrectionWithClaims } from "@effect-ontology/Schema/Timeline.ts"
 *
 * const affectedCount = (correction: CorrectionWithClaims) => correction.affectedClaims.length
 * console.log(affectedCount)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CorrectionWithClaims extends S.Class<CorrectionWithClaims>($I`CorrectionWithClaims`)(
  {
    id: S.NonEmptyString,
    correctionType: S.NonEmptyString,
    reason: S.OptionFromNullishOr(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault),
    correctionDate: S.DateTimeUtcFromString,
    sourceArticle: S.OptionFromNullishOr(ArticleSummary).pipe(SchemaUtils.withNoneDefault),
    affectedClaims: S.Array(AffectedClaim).pipe(SchemaUtils.withEmptyArrayDefaults<typeof AffectedClaim.Type>()),
  },
  $I.annote("CorrectionWithClaims", {
    description: "Correction record with optional source article and normalized original/replacement claim pairs.",
  })
) {}

/**
 * Correction-history response for one article.
 *
 * **Example** (Use CorrectionHistoryResponse)
 * ```ts
 * import { CorrectionHistoryResponse } from "@effect-ontology/Schema/Timeline.ts"
 *
 * const response = CorrectionHistoryResponse.make({ articleId: "article-42" })
 * console.log(response.corrections.length) // 0
 * ```
 *
 * @category dtos
 * @since 0.0.0
 */
export class CorrectionHistoryResponse extends S.Class<CorrectionHistoryResponse>($I`CorrectionHistoryResponse`)(
  {
    articleId: S.NonEmptyString,
    corrections: S.Array(CorrectionWithClaims).pipe(SchemaUtils.withEmptyArrayDefaults<CorrectionWithClaims>()),
  },
  $I.annote("CorrectionHistoryResponse", {
    description: "Article correction-history response with an always-present correction collection.",
  })
) {}

const ConflictStatus = LiteralKit(["pending", "resolved", "ignored"])
  .annotate({
    toArbitrary: () => (fc) => fc.constantFrom("pending", "resolved", "ignored"),
  })
  .annotate(
    $I.annote("ConflictStatus", {
      description: "Lifecycle statuses assigned to detected claim conflicts.",
    })
  );

const ConflictType = LiteralKit(["position", "temporal", "contradictory", "duplicate"])
  .annotate({
    toArbitrary: () => (fc) => fc.constantFrom("position", "temporal", "contradictory", "duplicate"),
  })
  .annotate(
    $I.annote("ConflictType", {
      description: "Supported semantic categories of claim conflict.",
    })
  );

/**
 * Filter and pagination query for detected claim conflicts.
 *
 * **Example** (Use ConflictsQuery)
 * ```ts
 * import { ConflictsQuery } from "@effect-ontology/Schema/Timeline.ts"
 *
 * const query = ConflictsQuery.fromUnknown({})
 * console.log(query.limit) // 20
 * ```
 *
 * @category dtos
 * @since 0.0.0
 */
export class ConflictsQuery extends S.Class<ConflictsQuery>($I`ConflictsQuery`)(
  {
    status: S.OptionFromOptionalKey(ConflictStatus).pipe(SchemaUtils.withNoneDefault),
    subject: S.OptionFromOptionalKey(IRI).pipe(SchemaUtils.withNoneDefault),
    limit: PositiveIntQuery.pipe(SchemaUtils.withKeyDefaults(PosInt.make(20))),
    offset: NonNegativeIntQuery.pipe(SchemaUtils.withKeyDefaults(NonNegativeInt.make(0))),
  },
  $I.annote("ConflictsQuery", {
    description: "Conflict filters with Option-normalized criteria and constrained pagination defaults.",
  })
) {
  static readonly fromUnknown = S.decodeUnknownSync(ConflictsQuery);
}

const ConflictPair = {
  id: S.NonEmptyString,
  conflictType: ConflictType,
  claimA: ClaimWithRank,
  claimB: ClaimWithRank,
};

const ClaimConflictDefinition = S.TaggedUnion({
  pending: ConflictPair,
  ignored: {
    ...ConflictPair,
    resolution: S.Struct({
      notes: S.OptionFromOptionalKey(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault),
    }),
  },
  resolved: {
    ...ConflictPair,
    resolution: S.Struct({
      strategy: S.NonEmptyString,
      acceptedClaimId: ClaimId,
      resolvedAt: S.DateTimeUtcFromString,
      notes: S.OptionFromOptionalKey(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault),
    }),
  },
});

/**
 * Claim conflict discriminated by resolution status.
 *
 * **Details**
 *
 * * Pending conflicts cannot carry resolution data. Resolved conflicts must carry
 * strategy, accepted assertion, resolution instant, and optional notes.
 *
 * **Example** (Use ClaimConflict)
 * ```ts
 * import type { ClaimConflict } from "@effect-ontology/Schema/Timeline.ts"
 *
 * const status = (conflict: ClaimConflict) => conflict._tag
 * console.log(status)
 * ```
 *
 * @invariant The `_tag` determines whether and which resolution data exists.
 * @category schemas
 * @since 0.0.0
 */
export const ClaimConflict = ClaimConflictDefinition.pipe(
  $I.annoteSchema("ClaimConflict", {
    description: "Tagged claim conflict with status-specific nested resolution data.",
    toArbitrary: () => S.toArbitrary(ClaimConflictDefinition),
  })
);

/**
 * Runtime value decoded by {@link ClaimConflict}.
 *
 * **Example** (Use ClaimConflict)
 * ```ts
 * import type { ClaimConflict } from "@effect-ontology/Schema/Timeline.ts"
 *
 * const conflictType = (conflict: ClaimConflict) => conflict.conflictType
 * console.log(conflictType)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ClaimConflict = typeof ClaimConflict.Type;

/**
 * Response containing detected claim conflicts and aggregate counts.
 *
 * **Example** (Use ConflictsResponse)
 * ```ts
 * import * as S from "effect/Schema"
 * import { ConflictsResponse } from "@effect-ontology/Schema/Timeline.ts"
 *
 * const response = S.decodeUnknownSync(ConflictsResponse)({
 *   total: 0,
 *   pendingCount: 0
 * })
 * console.log(response.conflicts.length) // 0
 * ```
 *
 * @invariant Counts are non-negative.
 * @category dtos
 * @since 0.0.0
 */
export class ConflictsResponse extends S.Class<ConflictsResponse>($I`ConflictsResponse`)(
  {
    conflicts: S.Array(ClaimConflict).pipe(SchemaUtils.withEmptyArrayDefaults<ClaimConflict>()),
    total: NonNegativeInt,
    pendingCount: NonNegativeInt,
  },
  $I.annote("ConflictsResponse", {
    description: "Detected-conflict response with tagged conflicts and non-negative aggregate counts.",
  })
) {}
