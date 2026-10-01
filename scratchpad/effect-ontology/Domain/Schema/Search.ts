/**
 * Claim, entity, suggestion, and article search contracts.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import { IRI } from "@beep/rdf";
import { SchemaGetter, Effect } from "effect";
import * as S from "effect/Schema";
import { RdfObject } from "./KnowledgeModel.ts";
import { ArticleSummary, ClaimRank, ClaimWithRank, OrderedUtcRange } from "./Timeline.ts";
import * as A from "effect/Array";
import { PosInt } from "../../Schema/PosInt.ts";

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

const claimSearchRequestLimitDefault = PosInt.make(20);
const claimSearchRequestOffsetDefault = S.Natural.make(0);
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
    predicates: IRI.pipe(S.Array, S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
    sources: S.NonEmptyString.pipe(S.Array, S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
    dateRange: S.OptionFromOptionalKey(OrderedUtcRange).pipe(S.withConstructorDefault(Effect.succeedNone)),
    rank: S.OptionFromOptionalKey(ClaimRank).pipe(S.withConstructorDefault(Effect.succeedNone)),
    limit: PosInt.pipe(S.withConstructorDefault(Effect.succeed(claimSearchRequestLimitDefault)), S.withDecodingDefaultTypeKey(Effect.succeed(claimSearchRequestLimitDefault))),
    offset: S.Natural.pipe(S.withConstructorDefault(Effect.succeed(claimSearchRequestOffsetDefault)), S.withDecodingDefaultTypeKey(Effect.succeed(claimSearchRequestOffsetDefault))),
  },
  $I.annote("ClaimSearchRequest", {
    description: "Claim-search body with normalized filters and constrained pagination defaults.",
  })
) {}

const PredicateFacet = S.Struct({
  iri: IRI,
  label: S.OptionFromNullishOr(S.NonEmptyString).pipe(S.withConstructorDefault(Effect.succeedNone)),
  count: S.Natural,
});

const SourceFacet = S.Struct({
  name: S.NonEmptyString,
  count: S.Natural,
});

const claimSearchFacetsPredicatesDefault = A.empty<typeof PredicateFacet.Type>();
const claimSearchFacetsSourcesDefault = A.empty<typeof SourceFacet.Type>();
const ClaimSearchFacets = S.Struct({
  predicates: S.Array(PredicateFacet).pipe(S.withConstructorDefault(Effect.succeed(claimSearchFacetsPredicatesDefault)), S.withDecodingDefaultType(Effect.succeed(claimSearchFacetsPredicatesDefault))),
  sources: S.Array(SourceFacet).pipe(S.withConstructorDefault(Effect.succeed(claimSearchFacetsSourcesDefault)), S.withDecodingDefaultType(Effect.succeed(claimSearchFacetsSourcesDefault))),
});

const claimSearchResponseClaimsDefault = A.empty<ClaimWithRank>();
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
    claims: S.Array(ClaimWithRank).pipe(S.withConstructorDefault(Effect.succeed(claimSearchResponseClaimsDefault)), S.withDecodingDefaultType(Effect.succeed(claimSearchResponseClaimsDefault))),
    total: S.Natural,
    limit: PosInt,
    offset: S.Natural,
    hasMore: S.Boolean,
    facets: S.OptionFromOptionalKey(ClaimSearchFacets).pipe(S.withConstructorDefault(Effect.succeedNone)),
  },
  $I.annote("ClaimSearchResponse", {
    description: "Paginated claim-search response with optional predicate and source facets.",
  })
) {}

const entitySearchRequestLimitDefault = PosInt.make(20);
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
    types: IRI.pipe(S.Array, S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
    limit: PosInt.pipe(S.withConstructorDefault(Effect.succeed(entitySearchRequestLimitDefault)), S.withDecodingDefaultTypeKey(Effect.succeed(entitySearchRequestLimitDefault))),
  },
  $I.annote("EntitySearchRequest", {
    description: "Entity-search body with optional ontology-type filter and positive result limit.",
  })
) {}

const EntityTopClaim = S.Struct({
  predicate: IRI,
  predicateLabel: S.OptionFromNullishOr(S.NonEmptyString).pipe(S.withConstructorDefault(Effect.succeedNone)),
  object: RdfObject,
});

const entitySearchResultTypesDefault = A.empty<IRI>();
const entitySearchResultTopClaimsDefault = A.empty<typeof EntityTopClaim.Type>();
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
    label: S.OptionFromNullishOr(S.NonEmptyString).pipe(S.withConstructorDefault(Effect.succeedNone)),
    types: S.Array(IRI).pipe(S.withConstructorDefault(Effect.succeed(entitySearchResultTypesDefault)), S.withDecodingDefaultType(Effect.succeed(entitySearchResultTypesDefault))),
    claimCount: S.Natural,
    topClaims: S.Array(EntityTopClaim).pipe(S.withConstructorDefault(Effect.succeed(entitySearchResultTopClaimsDefault)), S.withDecodingDefaultType(Effect.succeed(entitySearchResultTopClaimsDefault))),
  },
  $I.annote("EntitySearchResult", {
    description: "Entity-search result with canonical IRIs, non-negative claim count, and normalized claim previews.",
  })
) {}

const entitySearchResponseEntitiesDefault = A.empty<EntitySearchResult>();
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
    entities: S.Array(EntitySearchResult).pipe(S.withConstructorDefault(Effect.succeed(entitySearchResponseEntitiesDefault)), S.withDecodingDefaultType(Effect.succeed(entitySearchResponseEntitiesDefault))),
    total: S.Natural,
  },
  $I.annote("EntitySearchResponse", {
    description: "Entity-search response with an always-present result collection and non-negative total.",
  })
) {}

const suggestionQueryLimitDefault = PosInt.make(10);
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
    limit: PositiveLimitFromString.pipe(S.withConstructorDefault(Effect.succeed(suggestionQueryLimitDefault)), S.withDecodingDefaultTypeKey(Effect.succeed(suggestionQueryLimitDefault))),
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
    type: S.OptionFromNullishOr(IRI).pipe(S.withConstructorDefault(Effect.succeedNone)),
    description: S.OptionFromNullishOr(S.NonEmptyString).pipe(S.withConstructorDefault(Effect.succeedNone)),
  },
  $I.annote("Suggestion", {
    description: "Entity suggestion with canonical resource/type IRIs and optional descriptive text.",
  })
) {}

const suggestionsResponseSuggestionsDefault = A.empty<Suggestion>();
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
    suggestions: S.Array(Suggestion).pipe(S.withConstructorDefault(Effect.succeed(suggestionsResponseSuggestionsDefault)), S.withDecodingDefaultType(Effect.succeed(suggestionsResponseSuggestionsDefault))),
  },
  $I.annote("SuggestionsResponse", {
    description: "Typeahead response with its original prefix and an always-present suggestion collection.",
  })
) {}

const articleSearchRequestLimitDefault = PosInt.make(20);
const articleSearchRequestOffsetDefault = S.Natural.make(0);
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
    query: S.OptionFromOptionalKey(S.NonEmptyString).pipe(S.withConstructorDefault(Effect.succeedNone)),
    sources: S.NonEmptyString.pipe(S.Array, S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
    dateRange: S.OptionFromOptionalKey(OrderedUtcRange).pipe(S.withConstructorDefault(Effect.succeedNone)),
    limit: PosInt.pipe(S.withConstructorDefault(Effect.succeed(articleSearchRequestLimitDefault)), S.withDecodingDefaultTypeKey(Effect.succeed(articleSearchRequestLimitDefault))),
    offset: S.Natural.pipe(S.withConstructorDefault(Effect.succeed(articleSearchRequestOffsetDefault)), S.withDecodingDefaultTypeKey(Effect.succeed(articleSearchRequestOffsetDefault))),
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
    claimCount: S.Natural,
    conflictCount: S.Natural,
  },
  $I.annote("ArticleSearchResult", {
    description: "Article-search hit with non-negative extracted-claim and pending-conflict counts.",
  })
) {}

const articleSearchResponseArticlesDefault = A.empty<ArticleSearchResult>();
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
    articles: S.Array(ArticleSearchResult).pipe(S.withConstructorDefault(Effect.succeed(articleSearchResponseArticlesDefault)), S.withDecodingDefaultType(Effect.succeed(articleSearchResponseArticlesDefault))),
    total: S.Natural,
    limit: PosInt,
    offset: S.Natural,
    hasMore: S.Boolean,
  },
  $I.annote("ArticleSearchResponse", {
    description: "Paginated article-search response with constrained counts and an always-present result collection.",
  })
) {}
