/**
 * Claim, entity, suggestion, and article search contracts.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import { NonNegativeInt, PosInt, SchemaUtils } from "@beep/schema";
import * as DateTime from "effect/DateTime";
import * as S from "effect/Schema";
import { IRI } from "../Rdf/Types.ts";
import { RdfObject } from "./KnowledgeModel.ts";
import { ArticleSummary, ClaimRank, ClaimWithRank } from "./Timeline.ts";

const $I = $ScratchpadId.create("effect-ontology/Domain/Schema/Search");

const SearchDateRangeFields = S.Struct({
  from: S.DateTimeUtcFromString.annotateKey({ description: "Inclusive UTC range start." }),
  to: S.DateTimeUtcFromString.annotateKey({ description: "Inclusive UTC range end." }),
});

const SearchDateRangeDefinition = SearchDateRangeFields.check(
  S.makeFilter(
    (range) =>
      DateTime.toEpochMillis(range.from) <= DateTime.toEpochMillis(range.to)
        ? undefined
        : {
            path: ["to"],
            issue: "Search date-range end must not precede its start.",
          },
    {
      identifier: $I`SearchDateRangeOrderCheck`,
      title: "Ordered Search Date Range",
      description: "A UTC search range whose end is not before its start.",
      message: "Search date-range end must be greater than or equal to its start.",
    }
  )
);

const SearchDateRangeFromSelf = S.declare((input: unknown): input is typeof SearchDateRangeDefinition.Type =>
  S.is(SearchDateRangeDefinition)(input)
).annotate({
  toArbitrary: () => (fc) =>
    fc
      .tuple(fc.integer({ min: 0, max: 4_000_000_000_000 }), fc.integer({ min: 0, max: 86_400_000 }))
      .map(([from, duration]) =>
        SearchDateRangeFields.make({
          from: S.decodeSync(S.DateTimeUtcFromMillis)(from),
          to: S.decodeSync(S.DateTimeUtcFromMillis)(from + duration),
        })
      ),
});

const SearchDateRange = SearchDateRangeDefinition.pipe(
  S.decodeTo(SearchDateRangeFromSelf),
  $I.annoteSchema("SearchDateRange", {
    description: "Ordered UTC date range used by search filters.",
  })
);

const PositiveLimitFromString = S.FiniteFromString.check(
  S.makeFilterGroup(
    [
      S.isInt({
        identifier: $I`SuggestionLimitIntegerCheck`,
        title: "Integer Suggestion Limit",
        description: "A suggestion-limit query value with no fractional component.",
        message: "Suggestion limit must be an integer.",
      }),
      S.isGreaterThan(0, {
        identifier: $I`SuggestionLimitPositiveCheck`,
        title: "Positive Suggestion Limit",
        description: "A suggestion-limit query value strictly greater than zero.",
        message: "Suggestion limit must be positive.",
      }),
    ],
    {
      identifier: $I`SuggestionLimitChecks`,
      title: "Suggestion Limit",
      description: "Positive integer checks for a URL-query suggestion limit.",
    }
  )
)
  .annotate({
    toArbitrary: () => (fc) => fc.integer({ min: 1, max: Number.MAX_SAFE_INTEGER }),
  })
  .pipe(
    $I.annoteSchema("PositiveLimitFromString", {
      description: "URL-query string decoded to a finite positive suggestion limit.",
    })
  );

/**
 * Body for full-text and faceted claim search.
 *
 * @example
 * ```ts
 * import { ClaimSearchRequest } from "@effect-ontology/Schema/Search.ts"
 *
 * const request = ClaimSearchRequest.fromUnknown({ query: "appointed director" })
 * console.log(request.limit) // 20
 * ```
 *
 * @invariant Query text is non-empty, limit is positive, and offset is
 * non-negative.
 * @category requests
 * @since 0.0.0
 */
export class ClaimSearchRequest extends S.Class<ClaimSearchRequest>($I`ClaimSearchRequest`)(
  {
    query: S.NonEmptyString,
    predicates: IRI.pipe(S.Array, S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    sources: S.NonEmptyString.pipe(S.Array, S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    dateRange: S.OptionFromOptionalKey(SearchDateRange).pipe(SchemaUtils.withNoneDefault),
    rank: S.OptionFromOptionalKey(ClaimRank).pipe(SchemaUtils.withNoneDefault),
    limit: PosInt.pipe(SchemaUtils.withKeyDefaults(PosInt.make(20))),
    offset: NonNegativeInt.pipe(SchemaUtils.withKeyDefaults(NonNegativeInt.make(0))),
  },
  $I.annote("ClaimSearchRequest", {
    description: "Claim-search body with normalized filters and constrained pagination defaults.",
  })
) {
  static readonly fromUnknown = S.decodeUnknownSync(ClaimSearchRequest);
}

const PredicateFacet = S.Struct({
  iri: IRI,
  label: S.OptionFromNullishOr(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault),
  count: NonNegativeInt,
});

const SourceFacet = S.Struct({
  name: S.NonEmptyString,
  count: NonNegativeInt,
});

const ClaimSearchFacets = S.Struct({
  predicates: S.Array(PredicateFacet).pipe(SchemaUtils.withEmptyArrayDefaults<typeof PredicateFacet.Type>()),
  sources: S.Array(SourceFacet).pipe(SchemaUtils.withEmptyArrayDefaults<typeof SourceFacet.Type>()),
});

/**
 * Paginated claim-search response and optional facets.
 *
 * @example
 * ```ts
 * import type { ClaimSearchResponse } from "@effect-ontology/Schema/Search.ts"
 *
 * const count = (response: ClaimSearchResponse) => response.claims.length
 * console.log(count)
 * ```
 *
 * @category responses
 * @since 0.0.0
 */
export class ClaimSearchResponse extends S.Class<ClaimSearchResponse>($I`ClaimSearchResponse`)(
  {
    query: S.NonEmptyString,
    claims: S.Array(ClaimWithRank).pipe(SchemaUtils.withEmptyArrayDefaults<ClaimWithRank>()),
    total: NonNegativeInt,
    limit: PosInt,
    offset: NonNegativeInt,
    hasMore: S.Boolean,
    facets: S.OptionFromOptionalKey(ClaimSearchFacets).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("ClaimSearchResponse", {
    description: "Paginated claim-search response with optional predicate and source facets.",
  })
) {}

/**
 * Body for label-oriented entity search.
 *
 * @example
 * ```ts
 * import { EntitySearchRequest } from "@effect-ontology/Schema/Search.ts"
 *
 * const request = EntitySearchRequest.fromUnknown({ query: "Alice" })
 * console.log(request.limit) // 20
 * ```
 *
 * @category requests
 * @since 0.0.0
 */
export class EntitySearchRequest extends S.Class<EntitySearchRequest>($I`EntitySearchRequest`)(
  {
    query: S.NonEmptyString,
    types: IRI.pipe(S.Array, S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    limit: PosInt.pipe(SchemaUtils.withKeyDefaults(PosInt.make(20))),
  },
  $I.annote("EntitySearchRequest", {
    description: "Entity-search body with optional ontology-type filter and positive result limit.",
  })
) {
  static readonly fromUnknown = S.decodeUnknownSync(EntitySearchRequest);
}

const EntityTopClaim = S.Struct({
  predicate: IRI,
  predicateLabel: S.OptionFromNullishOr(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault),
  object: RdfObject,
});

/**
 * Entity-search hit with semantic type and claim previews.
 *
 * @example
 * ```ts
 * import type { EntitySearchResult } from "@effect-ontology/Schema/Search.ts"
 *
 * const claimCount = (result: EntitySearchResult) => result.claimCount
 * console.log(claimCount)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EntitySearchResult extends S.Class<EntitySearchResult>($I`EntitySearchResult`)(
  {
    iri: IRI,
    label: S.OptionFromNullishOr(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault),
    types: S.Array(IRI).pipe(SchemaUtils.withEmptyArrayDefaults<IRI>()),
    claimCount: NonNegativeInt,
    topClaims: S.Array(EntityTopClaim).pipe(SchemaUtils.withEmptyArrayDefaults<typeof EntityTopClaim.Type>()),
  },
  $I.annote("EntitySearchResult", {
    description: "Entity-search result with canonical IRIs, non-negative claim count, and normalized claim previews.",
  })
) {}

/**
 * Response containing entity-search hits.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { EntitySearchResponse } from "@effect-ontology/Schema/Search.ts"
 *
 * const response = S.decodeUnknownSync(EntitySearchResponse)({
 *   query: "Alice",
 *   total: 0
 * })
 * console.log(response.entities.length) // 0
 * ```
 *
 * @category responses
 * @since 0.0.0
 */
export class EntitySearchResponse extends S.Class<EntitySearchResponse>($I`EntitySearchResponse`)(
  {
    query: S.NonEmptyString,
    entities: S.Array(EntitySearchResult).pipe(SchemaUtils.withEmptyArrayDefaults<EntitySearchResult>()),
    total: NonNegativeInt,
  },
  $I.annote("EntitySearchResponse", {
    description: "Entity-search response with an always-present result collection and non-negative total.",
  })
) {}

/**
 * URL-query parameters for search suggestions.
 *
 * @example
 * ```ts
 * import { SuggestionQuery } from "@effect-ontology/Schema/Search.ts"
 *
 * const query = SuggestionQuery.fromUnknown({ prefix: "Ali" })
 * console.log(query.limit) // 10
 * ```
 *
 * @category requests
 * @since 0.0.0
 */
export class SuggestionQuery extends S.Class<SuggestionQuery>($I`SuggestionQuery`)(
  {
    prefix: S.NonEmptyString,
    limit: PositiveLimitFromString.pipe(SchemaUtils.withKeyDefaults(PosInt.make(10))),
  },
  $I.annote("SuggestionQuery", {
    description: "Suggestion query with non-empty prefix and a positive limit decoded from URL text.",
  })
) {
  static readonly fromUnknown = S.decodeUnknownSync(SuggestionQuery);
}

/**
 * Individual entity suggestion.
 *
 * @example
 * ```ts
 * import type { Suggestion } from "@effect-ontology/Schema/Search.ts"
 *
 * const label = (suggestion: Suggestion) => suggestion.label
 * console.log(label)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Suggestion extends S.Class<Suggestion>($I`Suggestion`)(
  {
    label: S.NonEmptyString,
    iri: IRI,
    type: S.OptionFromNullishOr(IRI).pipe(SchemaUtils.withNoneDefault),
    description: S.OptionFromNullishOr(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("Suggestion", {
    description: "Entity suggestion with canonical resource/type IRIs and optional descriptive text.",
  })
) {}

/**
 * Response containing typeahead suggestions.
 *
 * @example
 * ```ts
 * import { SuggestionsResponse } from "@effect-ontology/Schema/Search.ts"
 *
 * const response = SuggestionsResponse.make({ prefix: "Ali" })
 * console.log(response.suggestions.length) // 0
 * ```
 *
 * @category responses
 * @since 0.0.0
 */
export class SuggestionsResponse extends S.Class<SuggestionsResponse>($I`SuggestionsResponse`)(
  {
    prefix: S.NonEmptyString,
    suggestions: S.Array(Suggestion).pipe(SchemaUtils.withEmptyArrayDefaults<Suggestion>()),
  },
  $I.annote("SuggestionsResponse", {
    description: "Typeahead response with its original prefix and an always-present suggestion collection.",
  })
) {}

/**
 * Body for searching source articles.
 *
 * @example
 * ```ts
 * import { ArticleSearchRequest } from "@effect-ontology/Schema/Search.ts"
 *
 * const request = ArticleSearchRequest.fromUnknown({})
 * console.log(request.limit) // 20
 * ```
 *
 * @category requests
 * @since 0.0.0
 */
export class ArticleSearchRequest extends S.Class<ArticleSearchRequest>($I`ArticleSearchRequest`)(
  {
    query: S.OptionFromOptionalKey(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault),
    sources: S.NonEmptyString.pipe(S.Array, S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    dateRange: S.OptionFromOptionalKey(SearchDateRange).pipe(SchemaUtils.withNoneDefault),
    limit: PosInt.pipe(SchemaUtils.withKeyDefaults(PosInt.make(20))),
    offset: NonNegativeInt.pipe(SchemaUtils.withKeyDefaults(NonNegativeInt.make(0))),
  },
  $I.annote("ArticleSearchRequest", {
    description: "Article-search body with normalized filters and constrained pagination defaults.",
  })
) {
  static readonly fromUnknown = S.decodeUnknownSync(ArticleSearchRequest);
}

/**
 * Source-article search hit and its aggregate knowledge counts.
 *
 * @example
 * ```ts
 * import type { ArticleSearchResult } from "@effect-ontology/Schema/Search.ts"
 *
 * const conflicts = (result: ArticleSearchResult) => result.conflictCount
 * console.log(conflicts)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ArticleSearchResult extends S.Class<ArticleSearchResult>($I`ArticleSearchResult`)(
  {
    article: ArticleSummary,
    claimCount: NonNegativeInt,
    conflictCount: NonNegativeInt,
  },
  $I.annote("ArticleSearchResult", {
    description: "Article-search hit with non-negative extracted-claim and pending-conflict counts.",
  })
) {}

/**
 * Paginated article-search response.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { ArticleSearchResponse } from "@effect-ontology/Schema/Search.ts"
 *
 * const response = S.decodeUnknownSync(ArticleSearchResponse)({
 *   total: 0,
 *   limit: 20,
 *   offset: 0,
 *   hasMore: false
 * })
 * console.log(response.articles.length) // 0
 * ```
 *
 * @category responses
 * @since 0.0.0
 */
export class ArticleSearchResponse extends S.Class<ArticleSearchResponse>($I`ArticleSearchResponse`)(
  {
    articles: S.Array(ArticleSearchResult).pipe(SchemaUtils.withEmptyArrayDefaults<ArticleSearchResult>()),
    total: NonNegativeInt,
    limit: PosInt,
    offset: NonNegativeInt,
    hasMore: S.Boolean,
  },
  $I.annote("ArticleSearchResponse", {
    description: "Paginated article-search response with constrained counts and an always-present result collection.",
  })
) {}
