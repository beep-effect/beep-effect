/**
 * Bitemporal timeline, correction-history, and conflict-query contracts.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import { IRI } from "@beep/rdf";
import { LiteralKit, NonNegativeInt, PosInt, SchemaUtils } from "@beep/schema";
import { Sha256Hex } from "@beep/schema/Sha256";
import { UUID } from "@beep/schema/String";
import { DateTime, SchemaGetter } from "effect";
import * as S from "effect/Schema";
import { OptionalConfidence } from "../Model/shared.ts";
import { ClaimRank, RdfObject, TextSpan } from "./KnowledgeModel.ts";

const $I = $ScratchpadId.create("effect-ontology/Domain/Schema/Timeline");
const Sha256HexString = Sha256Hex.pipe(S.decodeTo(S.String));

export { ClaimRank };

/**
 * Database UUID identifying one persisted claim row.
 *
 * **Example** (Decode a persisted claim identifier)
 *
 * ```ts
 * import { PersistedClaimId } from "@effect-ontology/Schema/Timeline"
 *
 * const id = PersistedClaimId.make("00000000-0000-4000-8000-000000000011")
 * console.log(id)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PersistedClaimId = UUID.annotate({
  toArbitrary: () => (fc) => fc.uuid().map(UUID.make),
}).pipe(
  $I.annoteSchema("PersistedClaimId", {
    description: "Database UUID identifying a persisted claim row, distinct from a content-derived ClaimId.",
  })
);
/**
 * Runtime value decoded by {@link PersistedClaimId}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type PersistedClaimId = typeof PersistedClaimId.Type;

/**
 * Database UUID identifying one persisted correction row.
 *
 * **Example** (Decode a persisted correction identifier)
 *
 * ```ts
 * import { PersistedCorrectionId } from "@effect-ontology/Schema/Timeline"
 *
 * const id = PersistedCorrectionId.make("00000000-0000-4000-8000-000000000099")
 * console.log(id)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PersistedCorrectionId = UUID.annotate({
  toArbitrary: () => (fc) => fc.uuid().map(UUID.make),
}).pipe(
  $I.annoteSchema("PersistedCorrectionId", {
    description: "Database UUID identifying a persisted correction row.",
  })
);
/**
 * Runtime value decoded by {@link PersistedCorrectionId}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type PersistedCorrectionId = typeof PersistedCorrectionId.Type;

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

const OrderedUtcRangeDefinition = S.Struct({
  from: S.DateTimeUtcFromString.annotateKey({
    description: "Inclusive UTC range start.",
  }),
  to: S.DateTimeUtcFromString.annotateKey({
    description: "Inclusive UTC range end.",
  }),
})
  .check(
    S.makeFilter(
      (range) =>
        DateTime.toEpochMillis(range.from) <= DateTime.toEpochMillis(range.to)
          ? undefined
          : {
              path: ["to"],
              issue: "Timeline range end must not precede its start.",
            },
      {
        identifier: $I`OrderedUtcRangeCheck`,
        title: "Ordered UTC Range",
        description: "A UTC range whose end is not before its start.",
        message: "UTC range end must be greater than or equal to its start.",
      }
    )
  )
  .pipe(SchemaUtils.withCodecStatics);

const OrderedUtcRangeFromSelf = S.declare((input: unknown): input is typeof OrderedUtcRangeDefinition.Type =>
  OrderedUtcRangeDefinition.is(input)
).annotate({
  toArbitrary: () => (fc) =>
    fc
      .tuple(fc.integer({ min: 0, max: 4_000_000_000_000 }), fc.integer({ min: 0, max: 86_400_000 }))
      .map(([from, duration]) =>
        OrderedUtcRangeDefinition.make({
          from: DateTime.makeUnsafe(from),
          to: DateTime.makeUnsafe(from + duration),
        })
      ),
});

/**
 * Ordered inclusive UTC date-time range shared by search and timeline inputs.
 *
 * **Example** (Decode an ordered range)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { OrderedUtcRange } from "@effect-ontology/Domain/Schema/Timeline"
 *
 * const range = S.decodeUnknownOption(OrderedUtcRange)({
 *   from: "2026-01-01T00:00:00.000Z",
 *   to: "2026-01-02T00:00:00.000Z"
 * })
 * console.log(range)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const OrderedUtcRange = OrderedUtcRangeDefinition.pipe(
  S.decodeTo(OrderedUtcRangeFromSelf),
  $I.annoteSchema("OrderedUtcRange", {
    description: "Ordered inclusive UTC range shared by search filters and timeline queries.",
  })
);

/**
 * Runtime value decoded by {@link OrderedUtcRange}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type OrderedUtcRange = typeof OrderedUtcRange.Type;

const TimelineRangeQuery = S.fromJsonString(OrderedUtcRangeDefinition).pipe(
  $I.annoteSchema("TimelineRangeQuery", {
    description: "JSON-encoded ordered UTC range accepted in a URL-query value.",
  })
);

/**
 * Compact source-article projection used for timeline attribution.
 *
 * **Example** (Use ArticleSummary)
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { ArticleSummary } from "@effect-ontology/Schema/Timeline"
 *
 * const article = S.decodeUnknownOption(ArticleSummary)({
 *   id: "article-42",
 *   uri: "https://example.com/news/42",
 *   publishedAt: "2026-07-25T10:00:00.000Z",
 *   ingestedAt: "2026-07-25T10:05:00.000Z"
 * })
 * console.log(O.map(article, (value) => value.id)) // Some("article-42")
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
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { ClaimWithRank } from "@effect-ontology/Schema/Timeline"
 *
 * const claim = S.decodeUnknownOption(ClaimWithRank)({
 *   id: "00000000-0000-4000-8000-000000000011",
 *   subject: "https://example.com/alice",
 *   predicate: "https://schema.org/name",
 *   object: {
 *     termType: "Literal",
 *     value: "Alice",
 *     datatype: {
 *       termType: "NamedNode",
 *       value: "https://www.w3.org/2001/XMLSchema#string"
 *     }
 *   },
 *   rank: "preferred",
 *   source: {
 *     id: "article-42",
 *     uri: "https://example.com/news/42",
 *     publishedAt: "2026-07-25T10:00:00.000Z",
 *     ingestedAt: "2026-07-25T10:05:00.000Z"
 *   },
 *   transactionTime: { assertedAt: "2026-07-25T10:05:00.000Z" }
 * })
 * console.log(O.map(claim, (value) => value.rank)) // Some("preferred")
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ClaimWithRank extends S.Class<ClaimWithRank>($I`ClaimWithRank`)(
  {
    id: PersistedClaimId,
    subject: IRI,
    predicate: IRI,
    object: RdfObject,
    rank: ClaimRank,
    source: ArticleSummary,
    validTime: S.OptionFromOptionalKey(OrderedUtcRange).pipe(SchemaUtils.withNoneDefault),
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
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { CorrectionSummary } from "@effect-ontology/Schema/Timeline"
 *
 * const correction = S.decodeUnknownOption(CorrectionSummary)({
 *   id: "00000000-0000-4000-8000-000000000099",
 *   correctionType: "update",
 *   correctionDate: "2026-07-25T12:00:00.000Z",
 *   originalClaimId: "00000000-0000-4000-8000-000000000011"
 * })
 * console.log(O.map(correction, (value) => value.correctionType)) // Some("update")
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CorrectionSummary extends S.Class<CorrectionSummary>($I`CorrectionSummary`)(
  {
    id: PersistedCorrectionId,
    correctionType: S.NonEmptyString,
    reason: S.OptionFromNullishOr(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault),
    correctionDate: S.DateTimeUtcFromString,
    originalClaimId: PersistedClaimId,
    newClaimId: S.OptionFromNullishOr(PersistedClaimId).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("CorrectionSummary", {
    description: "Compact correction record linking an original claim to an optional replacement.",
  })
) {}

/**
 * Article detail response with its timeline claims and aggregate counts.
 *
 * **Example** (Use ArticleDetailResponse)
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { ArticleDetailResponse } from "@effect-ontology/Schema/Timeline"
 *
 * const response = S.decodeUnknownOption(ArticleDetailResponse)({
 *   article: {
 *     id: "article-42",
 *     uri: "https://example.com/news/42",
 *     publishedAt: "2026-07-25T10:00:00.000Z",
 *     ingestedAt: "2026-07-25T10:05:00.000Z"
 *   },
 *   entityCount: 0,
 *   conflictCount: 0
 * })
 * console.log(O.map(response, (value) => value.claims.length)) // Some(0)
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
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { TimelineEntityQuery } from "@effect-ontology/Schema/Timeline"
 *
 * const query = S.decodeUnknownOption(TimelineEntityQuery)({ ontologyId: "ontology-a" })
 * console.log(O.map(query, (value) => value.includeDeprecated)) // Some(false)
 * ```
 *
 * @category dtos
 * @since 0.0.0
 */
export class TimelineEntityQuery extends S.Class<TimelineEntityQuery>($I`TimelineEntityQuery`)(
  {
    ontologyId: S.NonEmptyString.annotateKey({ description: "Ontology scope for the timeline query." }),
    asOf: S.OptionFromOptionalKey(S.DateTimeUtcFromString).pipe(SchemaUtils.withNoneDefault),
    range: S.OptionFromOptionalKey(TimelineRangeQuery).pipe(SchemaUtils.withNoneDefault),
    includeDeprecated: BooleanQueryValue.pipe(SchemaUtils.withKeyDefaults(false)),
  },
  $I.annote("TimelineEntityQuery", {
    description: "Entity-timeline query with optional UTC snapshot/range and a false deprecated-claim default.",
  })
) {}

/**
 * Timeline response for one entity IRI.
 *
 * **Example** (Use TimelineEntityResponse)
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { TimelineEntityResponse } from "@effect-ontology/Schema/Timeline"
 *
 * const response = S.decodeUnknownOption(TimelineEntityResponse)({
 *   iri: "https://example.com/alice"
 * })
 * console.log(O.map(response, (value) => value.corrections.length)) // Some(0)
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
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { TimelineClaimsQuery } from "@effect-ontology/Schema/Timeline"
 *
 * const query = S.decodeUnknownOption(TimelineClaimsQuery)({ ontologyId: "ontology-a" })
 * console.log(O.map(query, (value) => value.limit)) // Some(20)
 * ```
 *
 * @category dtos
 * @since 0.0.0
 */
export class TimelineClaimsQuery extends S.Class<TimelineClaimsQuery>($I`TimelineClaimsQuery`)(
  {
    ontologyId: S.NonEmptyString.annotateKey({ description: "Ontology scope for the claim query." }),
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
) {}

/**
 * Paginated response containing timeline claims.
 *
 * **Example** (Use TimelineClaimsResponse)
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { TimelineClaimsResponse } from "@effect-ontology/Schema/Timeline"
 *
 * const response = S.decodeUnknownOption(TimelineClaimsResponse)({
 *   total: 0,
 *   limit: 20,
 *   offset: 0,
 *   hasMore: false
 * })
 * console.log(O.map(response, (value) => value.hasMore)) // Some(false)
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
 * import { CorrectionHistoryQuery } from "@effect-ontology/Schema/Timeline"
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
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { CorrectionWithClaims } from "@effect-ontology/Schema/Timeline"
 *
 * const correction = S.decodeUnknownOption(CorrectionWithClaims)({
 *   id: "corr-1",
 *   correctionType: "update",
 *   correctionDate: "2026-07-25T12:00:00.000Z"
 * })
 * console.log(O.map(correction, (value) => value.affectedClaims.length)) // Some(0)
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
 * import { CorrectionHistoryResponse } from "@effect-ontology/Schema/Timeline"
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

/**
 * Lifecycle vocabulary for persisted claim conflicts.
 *
 * **Example** (Check a pending status)
 *
 * ```ts
 * import { ConflictStatus } from "@effect-ontology/Domain/Schema/Timeline"
 *
 * console.log(ConflictStatus.is.pending("pending")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ConflictStatus = LiteralKit(["pending", "resolved", "ignored"])
  .annotate({
    toArbitrary: () => (fc) => fc.constantFrom("pending", "resolved", "ignored"),
  })
  .annotate(
    $I.annote("ConflictStatus", {
      description: "Lifecycle statuses assigned to detected claim conflicts.",
    })
  );

/**
 * Decoded lifecycle value accepted by {@link ConflictStatus}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ConflictStatus = typeof ConflictStatus.Type;

/**
 * Authoritative semantic categories persisted for claim conflicts.
 *
 * **Example** (Check a temporal conflict kind)
 *
 * ```ts
 * import { ConflictKind } from "@effect-ontology/Domain/Schema/Timeline"
 *
 * console.log(ConflictKind.is.temporal("temporal")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ConflictKind = LiteralKit(["position", "temporal"])
  .annotate({
    toArbitrary: () => (fc) => fc.constantFrom("position", "temporal"),
  })
  .annotate(
    $I.annote("ConflictKind", {
      description: "Authoritative semantic categories persisted for claim conflicts.",
    })
  );

/**
 * Decoded semantic category accepted by {@link ConflictKind}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ConflictKind = typeof ConflictKind.Type;

/**
 * Request-local identity recorded when a conflict reaches a terminal state.
 *
 * **Example** (Create a system actor)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { ConflictActor } from "@effect-ontology/Domain/Schema/Timeline"
 *
 * const actor = ConflictActor.make({ principal: "system", credentialFingerprint: O.none() })
 * console.log(actor.principal) // "system"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ConflictActor extends S.Class<ConflictActor>($I`ConflictActor`)(
  {
    principal: S.NonEmptyString,
    credentialFingerprint: S.Option(Sha256HexString),
  },
  $I.annote("ConflictActor", {
    description: "Authenticated request principal and optional irreversible credential fingerprint.",
  })
) {}

/**
 * Filter and pagination query for detected claim conflicts.
 *
 * **Example** (Use ConflictsQuery)
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { ConflictsQuery } from "@effect-ontology/Schema/Timeline"
 *
 * const query = S.decodeUnknownOption(ConflictsQuery)({ ontologyId: "acme" })
 * console.log(O.map(query, (value) => value.limit)) // Some(20)
 * ```
 *
 * @category dtos
 * @since 0.0.0
 */
export class ConflictsQuery extends S.Class<ConflictsQuery>($I`ConflictsQuery`)(
  {
    ontologyId: S.NonEmptyString,
    status: S.OptionFromOptionalKey(ConflictStatus).pipe(SchemaUtils.withNoneDefault),
    subject: S.OptionFromOptionalKey(IRI).pipe(SchemaUtils.withNoneDefault),
    articleId: S.OptionFromOptionalKey(UUID).pipe(SchemaUtils.withNoneDefault),
    limit: PositiveIntQuery.pipe(SchemaUtils.withKeyDefaults(PosInt.make(20))),
    offset: NonNegativeIntQuery.pipe(SchemaUtils.withKeyDefaults(NonNegativeInt.make(0))),
  },
  $I.annote("ConflictsQuery", {
    description: "Conflict filters with Option-normalized criteria and constrained pagination defaults.",
  })
) {}

const ConflictPair = {
  id: S.NonEmptyString,
  ontologyId: S.NonEmptyString,
  conflictType: ConflictKind,
  claimA: ClaimWithRank,
  claimB: ClaimWithRank,
};

const ClaimConflictDefinition = S.TaggedUnion({
  pending: ConflictPair,
  ignored: {
    ...ConflictPair,
    resolution: S.Struct({
      resolvedBy: S.NonEmptyString,
      resolvedAt: S.DateTimeUtcFromString,
      notes: S.OptionFromOptionalKey(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault),
    }),
  },
  resolved: {
    ...ConflictPair,
    resolution: S.Struct({
      strategy: S.NonEmptyString,
      acceptedClaimId: PersistedClaimId,
      resolvedBy: S.NonEmptyString,
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
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { ClaimConflict } from "@effect-ontology/Schema/Timeline"
 *
 * const ranked = {
 *   id: "00000000-0000-4000-8000-000000000011",
 *   subject: "https://example.com/alice",
 *   predicate: "https://schema.org/name",
 *   object: {
 *     termType: "Literal",
 *     value: "Alice",
 *     datatype: {
 *       termType: "NamedNode",
 *       value: "https://www.w3.org/2001/XMLSchema#string"
 *     }
 *   },
 *   rank: "preferred",
 *   source: {
 *     id: "article-42",
 *     uri: "https://example.com/news/42",
 *     publishedAt: "2026-07-25T10:00:00.000Z",
 *     ingestedAt: "2026-07-25T10:05:00.000Z"
 *   },
 *   transactionTime: { assertedAt: "2026-07-25T10:05:00.000Z" }
 * }
 * const conflict = S.decodeUnknownOption(ClaimConflict)({
 *   _tag: "pending",
 *   id: "conflict-1",
 *   ontologyId: "ontology-a",
 *   conflictType: "position",
 *   claimA: ranked,
 *   claimB: ranked
 * })
 * console.log(O.map(conflict, (value) => value._tag)) // Some("pending")
 * console.log(O.map(conflict, (value) => value.conflictType)) // Some("position")
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
 * @category type-level
 * @since 0.0.0
 */
export type ClaimConflict = typeof ClaimConflict.Type;

const ConflictTransitionDefinition = S.TaggedUnion({
  ignore: {
    notes: S.OptionFromOptionalKey(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault),
  },
  resolve: {
    acceptedClaim: LiteralKit(["claimA", "claimB"]),
    strategy: S.NonEmptyString,
    notes: S.OptionFromOptionalKey(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault),
  },
});

/**
 * Tagged command accepted by the conflict transition endpoint.
 *
 * **Example** (Ignore a conflict)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { ConflictTransition } from "@effect-ontology/Domain/Schema/Timeline"
 *
 * const action = ConflictTransition.cases.ignore.make({ notes: O.none() })
 * console.log(action._tag) // "ignore"
 * ```
 *
 * @category dtos
 * @since 0.0.0
 */
export const ConflictTransition = ConflictTransitionDefinition.pipe(
  $I.annoteSchema("ConflictTransition", {
    description: "One legal pending-to-terminal claim-conflict transition.",
    toArbitrary: () => S.toArbitrary(ConflictTransitionDefinition),
  })
);

/**
 * Runtime value decoded by {@link ConflictTransition}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ConflictTransition = typeof ConflictTransition.Type;

/**
 * Response containing detected claim conflicts and aggregate counts.
 *
 * **Example** (Use ConflictsResponse)
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { ConflictsResponse } from "@effect-ontology/Schema/Timeline"
 *
 * const response = S.decodeUnknownOption(ConflictsResponse)({
 *   total: 0,
 *   pendingCount: 0
 * })
 * console.log(O.map(response, (value) => value.conflicts.length)) // 0
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
