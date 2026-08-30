/**
 * Claim, entity, suggestion, and article search contracts.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import { IRI } from "@beep/rdf";
import { NonNegativeInt, PosInt, SchemaUtils } from "@beep/schema";
import { SchemaGetter } from "effect";
import * as S from "effect/Schema";
import { RdfObject } from "./KnowledgeModel.ts";
import { ArticleSummary, ClaimRank, ClaimWithRank, OrderedUtcRange } from "./Timeline.ts";

const $I = $ScratchpadId.create("effect-ontology/Domain/Schema/Search");

const PositiveLimitFromString = S.FiniteFromString.pipe(
  S.decodeTo(PosInt, {
    decode: SchemaGetter.transform(PosInt.make),
    encode: SchemaGetter.transform((value): number => value),
  }),
  $I.annoteSchema("PositiveLimitFromString", {
    description: "URL-query string decoded to a finite positive suggestion limit.",
  })
);

/**
 * Body for full-text and faceted claim search.
 *
 * **Example** (Use ClaimSearchRequest)
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { ClaimSearchRequest } from "@effect-ontology/Schema/Search"
 *
 * const request = S.decodeUnknownOption(ClaimSearchRequest)({ ontologyId: "ontology-a", query: "appointed director" })
 * console.log(O.map(request, (value) => value.limit)) // Some(20)
 * ```
 *
 * @invariant Query text is non-empty, limit is positive, and offset is
 * non-negative.
 * @category dtos
 * @since 0.0.0
 */
export class ClaimSearchRequest extends S.Class<ClaimSearchRequest>($I`ClaimSearchRequest`)(
  {
    ontologyId: S.NonEmptyString.annotateKey({ description: "Ontology scope for claim search." }),
    query: S.NonEmptyString,
    predicates: IRI.pipe(S.Array, S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    sources: S.NonEmptyString.pipe(S.Array, S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    dateRange: S.OptionFromOptionalKey(OrderedUtcRange).pipe(SchemaUtils.withNoneDefault),
    rank: S.OptionFromOptionalKey(ClaimRank).pipe(SchemaUtils.withNoneDefault),
    limit: PosInt.pipe(SchemaUtils.withKeyDefaults(PosInt.make(20))),
    offset: NonNegativeInt.pipe(SchemaUtils.withKeyDefaults(NonNegativeInt.make(0))),
  },
  $I.annote("ClaimSearchRequest", {
    description: "Claim-search body with normalized filters and constrained pagination defaults.",
  })
) {}

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
 * **Example** (Use ClaimSearchResponse)
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { ClaimSearchResponse } from "@effect-ontology/Schema/Search"
 *
 * const response = S.decodeUnknownOption(ClaimSearchResponse)({
 *   query: "appointed director",
 *   claims: [],
 *   total: 0,
 *   limit: 20,
 *   offset: 0,
 *   hasMore: false
 * })
 * console.log(O.map(response, (value) => value.claims.length)) // Some(0)
 * console.log(O.map(response, (value) => value.total)) // Some(0)
 * ```
 *
 * @category dtos
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
 * **Example** (Use EntitySearchRequest)
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { EntitySearchRequest } from "@effect-ontology/Schema/Search"
 *
 * const request = S.decodeUnknownOption(EntitySearchRequest)({ ontologyId: "ontology-a", query: "Alice" })
 * console.log(O.map(request, (value) => value.limit)) // Some(20)
 * ```
 *
 * @category dtos
 * @since 0.0.0
 */
export class EntitySearchRequest extends S.Class<EntitySearchRequest>($I`EntitySearchRequest`)(
  {
    ontologyId: S.NonEmptyString.annotateKey({ description: "Ontology scope for entity search." }),
    query: S.NonEmptyString,
    types: IRI.pipe(S.Array, S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    limit: PosInt.pipe(SchemaUtils.withKeyDefaults(PosInt.make(20))),
  },
  $I.annote("EntitySearchRequest", {
    description: "Entity-search body with optional ontology-type filter and positive result limit.",
  })
) {}

const EntityTopClaim = S.Struct({
  predicate: IRI,
  predicateLabel: S.OptionFromNullishOr(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault),
  object: RdfObject,
});

/**
 * Entity-search hit with semantic type and claim previews.
 *
 * **Example** (Use EntitySearchResult)
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { EntitySearchResult } from "@effect-ontology/Schema/Search"
 *
 * const result = S.decodeUnknownOption(EntitySearchResult)({
 *   iri: "https://example.com/alice",
 *   label: "Alice",
 *   claimCount: 0
 * })
 * console.log(O.flatMap(result, (value) => value.label)) // Some("Alice")
 * console.log(O.map(result, (value) => value.claimCount)) // Some(0)
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
 * **Example** (Use EntitySearchResponse)
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { EntitySearchResponse } from "@effect-ontology/Schema/Search"
 *
 * const response = S.decodeUnknownOption(EntitySearchResponse)({
 *   query: "Alice",
 *   total: 0
 * })
 * console.log(O.map(response, (value) => value.entities.length)) // 0
 * ```
 *
 * @category dtos
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
 * **Example** (Use SuggestionQuery)
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { SuggestionQuery } from "@effect-ontology/Schema/Search"
 *
 * const query = S.decodeUnknownOption(SuggestionQuery)({ ontologyId: "ontology-a", prefix: "Ali" })
 * console.log(O.map(query, (value) => value.limit)) // Some(10)
 * ```
 *
 * @category dtos
 * @since 0.0.0
 */
export class SuggestionQuery extends S.Class<SuggestionQuery>($I`SuggestionQuery`)(
  {
    ontologyId: S.NonEmptyString.annotateKey({ description: "Ontology scope for suggestions." }),
    prefix: S.NonEmptyString,
    limit: PositiveLimitFromString.pipe(SchemaUtils.withKeyDefaults(PosInt.make(10))),
  },
  $I.annote("SuggestionQuery", {
    description: "Suggestion query with non-empty prefix and a positive limit decoded from URL text.",
  })
) {}

/**
 * Individual entity suggestion.
 *
 * **Example** (Use Suggestion)
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { Suggestion } from "@effect-ontology/Schema/Search"
 *
 * const suggestion = S.decodeUnknownOption(Suggestion)({
 *   label: "Alice",
 *   iri: "https://example.com/alice"
 * })
 * console.log(O.map(suggestion, (value) => value.label)) // Some("Alice")
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
 * **Example** (Use SuggestionsResponse)
 * ```ts
 * import { SuggestionsResponse } from "@effect-ontology/Schema/Search"
 *
 * const response = SuggestionsResponse.make({ prefix: "Ali" })
 * console.log(response.suggestions.length) // 0
 * ```
 *
 * @category dtos
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
 * **Example** (Use ArticleSearchRequest)
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { ArticleSearchRequest } from "@effect-ontology/Schema/Search"
 *
 * const request = S.decodeUnknownOption(ArticleSearchRequest)({ ontologyId: "ontology-a" })
 * console.log(O.map(request, (value) => value.limit)) // Some(20)
 * ```
 *
 * @category dtos
 * @since 0.0.0
 */
export class ArticleSearchRequest extends S.Class<ArticleSearchRequest>($I`ArticleSearchRequest`)(
  {
    ontologyId: S.NonEmptyString.annotateKey({ description: "Ontology scope for article search." }),
    query: S.OptionFromOptionalKey(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault),
    sources: S.NonEmptyString.pipe(S.Array, S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    dateRange: S.OptionFromOptionalKey(OrderedUtcRange).pipe(SchemaUtils.withNoneDefault),
    limit: PosInt.pipe(SchemaUtils.withKeyDefaults(PosInt.make(20))),
    offset: NonNegativeInt.pipe(SchemaUtils.withKeyDefaults(NonNegativeInt.make(0))),
  },
  $I.annote("ArticleSearchRequest", {
    description: "Article-search body with normalized filters and constrained pagination defaults.",
  })
) {}

/**
 * Source-article search hit and its aggregate knowledge counts.
 *
 * **Example** (Use ArticleSearchResult)
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { ArticleSearchResult } from "@effect-ontology/Schema/Search"
 *
 * const result = S.decodeUnknownOption(ArticleSearchResult)({
 *   article: {
 *     id: "article-42",
 *     uri: "https://example.com/news/42",
 *     publishedAt: "2026-07-25T10:00:00.000Z",
 *     ingestedAt: "2026-07-25T10:05:00.000Z"
 *   },
 *   claimCount: 0,
 *   conflictCount: 0
 * })
 * console.log(O.map(result, (value) => value.conflictCount)) // Some(0)
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
 * **Example** (Use ArticleSearchResponse)
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { ArticleSearchResponse } from "@effect-ontology/Schema/Search"
 *
 * const response = S.decodeUnknownOption(ArticleSearchResponse)({
 *   total: 0,
 *   limit: 20,
 *   offset: 0,
 *   hasMore: false
 * })
 * console.log(O.map(response, (value) => value.articles.length)) // 0
 * ```
 *
 * @category dtos
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
