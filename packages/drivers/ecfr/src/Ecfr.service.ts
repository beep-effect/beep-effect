/**
 * Effect service for the keyless eCFR versioner REST API.
 *
 * The 2nd consumer of the shared transport transformer incubated in
 * `@beep/govinfo`: it builds a raw `HttpClient` on the `HttpClient.mapRequest`
 * path (base-URL prefixing) and threads it through `transport.transformClient`
 * (auth = `NoAuth`, plus rate-limit + retry). Value models + operation
 * descriptors come from the committed `openapi.json` via `src/_generated/*`, so
 * build/check are network-free.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { ApiAuth, makeApiTransport } from "@beep/api-transport";
import { $EcfrId } from "@beep/identity";
import { LiteralKit, NonNegativeInt, SchemaUtils, URLStr } from "@beep/schema";
import { O } from "@beep/utils";
import { Config, Context, Effect, Layer, Match, Stream } from "effect";
import * as S from "effect/Schema";
import { FetchHttpClient } from "effect/unstable/http";
import * as HttpApiClient from "effect/unstable/httpapi/HttpApiClient";
import * as RateLimiter from "effect/unstable/persistence/RateLimiter";
import * as G from "./_generated/Ecfr.gen.ts";
import { ECFR_API_URL, ECFR_RATE_LIMIT, ECFR_RATE_LIMIT_WINDOW, EcfrConfigInput } from "./Ecfr.config.ts";
import { EcfrError, EcfrErrorOptions } from "./Ecfr.errors.ts";
import type { RateLimitSnapshot } from "@beep/api-transport";
import type * as HttpClient from "effect/unstable/http/HttpClient";
import type * as HttpClientError from "effect/unstable/http/HttpClientError";

const $I = $EcfrId.create("Ecfr.service");
const SearchOrderBase = LiteralKit([
  "citations",
  "hierarchy",
  "newest_first",
  "oldest_first",
  "relevance",
  "suggestions",
]);
const SearchOrder = SearchOrderBase.pipe(
  $I.annoteSchema("SearchOrder", { description: "Sort order accepted by eCFR search endpoints." }),
  SchemaUtils.withLiteralKitStatics(SearchOrderBase)
);
const SearchPaginationBase = LiteralKit(["date", "results"]);
const SearchPagination = SearchPaginationBase.pipe(
  $I.annoteSchema("SearchPagination", { description: "Pagination grouping accepted by eCFR search results." }),
  SchemaUtils.withLiteralKitStatics(SearchPaginationBase)
);
const DatePathSegment = S.String.check(
  S.isPattern(/^\d{4}-\d{2}-\d{2}$/u, {
    identifier: $I`DatePathSegmentCheck`,
    title: "eCFR date path segment",
    description: "An ISO calendar-date spelling that is safe to substitute into an eCFR URL path.",
    message: "Expected an eCFR path date in YYYY-MM-DD form",
  })
).pipe(
  $I.annoteSchema("DatePathSegment", {
    description: "An ISO date string accepted in dated eCFR versioner paths.",
  })
);
const TitlePathSegment = S.String.check(
  S.isPattern(/^[A-Za-z0-9._~-]+$/u, {
    identifier: $I`TitlePathSegmentCheck`,
    title: "eCFR title path segment",
    description: "A non-empty title identifier made only from unreserved URL path-segment characters.",
    message: "Expected an eCFR title containing only unreserved URL path-segment characters",
  })
).pipe(
  $I.annoteSchema("TitlePathSegment", {
    description: "A title identifier accepted in eCFR URL paths.",
  })
);
const optional = <A, I, R>(schema: S.Codec<A, I, R>) =>
  S.OptionFromOptionalKey(schema).pipe(SchemaUtils.withNoneDefault);

/**
 * Optional filters accepted by the eCFR corrections listing endpoint.
 *
 * **Example** (Make params with title filter)
 *
 * ```ts
 * import { EcfrCorrectionsParams } from "@beep/ecfr"
 * import * as O from "effect/Option"
 *
 * const params = EcfrCorrectionsParams.make({ title: O.some("1") })
 * console.log(params.title)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EcfrCorrectionsParams extends S.Class<EcfrCorrectionsParams>($I`EcfrCorrectionsParams`)(
  {
    date: optional(S.String),
    errorCorrectedDate: optional(S.String),
    title: optional(S.String),
  },
  $I.annote("EcfrCorrectionsParams", {
    description: "Optional title and ISO-date filters for eCFR corrections.",
  })
) {}

/**
 * Path parameters identifying one CFR title.
 *
 * **Example** (Make title path params)
 *
 * ```ts
 * import { EcfrTitleParams } from "@beep/ecfr"
 *
 * const params = EcfrTitleParams.make({ title: "1" })
 * console.log(params.title)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EcfrTitleParams extends S.Class<EcfrTitleParams>($I`EcfrTitleParams`)(
  { title: TitlePathSegment },
  $I.annote("EcfrTitleParams", { description: "Path parameters identifying one CFR title." })
) {}

/**
 * Filters and page controls shared by the eCFR search family.
 *
 * **Example** (Make search params with pagination)
 *
 * ```ts
 * import { EcfrSearchParams } from "@beep/ecfr"
 * import { NonNegativeInt } from "@beep/schema"
 * import * as O from "effect/Option"
 *
 * const params = EcfrSearchParams.make({
 *   query: O.some("water"),
 *   page: O.some(NonNegativeInt.make(1)),
 *   perPage: O.some(NonNegativeInt.make(20))
 * })
 * console.log(params.query)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EcfrSearchParams extends S.Class<EcfrSearchParams>($I`EcfrSearchParams`)(
  {
    agencySlugs: optional(S.String.pipe(S.Array)),
    date: optional(S.String),
    lastModifiedAfter: optional(S.String),
    lastModifiedBefore: optional(S.String),
    lastModifiedOnOrAfter: optional(S.String),
    lastModifiedOnOrBefore: optional(S.String),
    order: optional(SearchOrder),
    page: optional(NonNegativeInt),
    paginateBy: optional(SearchPagination),
    perPage: optional(NonNegativeInt),
    query: optional(S.String),
  },
  $I.annote("EcfrSearchParams", {
    description: "Filters, ordering, and page controls shared by eCFR search endpoints.",
  })
) {}

/**
 * Path and optional hierarchy parameters for dated eCFR versioner requests.
 *
 * **Example** (Make versioner params with hierarchy)
 *
 * ```ts
 * import { EcfrVersionerParams } from "@beep/ecfr"
 * import * as O from "effect/Option"
 *
 * const params = EcfrVersionerParams.make({ date: "2026-07-01", title: "1", part: O.some("1") })
 * console.log(params.date)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EcfrVersionerParams extends S.Class<EcfrVersionerParams>($I`EcfrVersionerParams`)(
  {
    appendix: optional(S.String),
    chapter: optional(S.String),
    date: DatePathSegment,
    part: optional(S.String),
    section: optional(S.String),
    subchapter: optional(S.String),
    subpart: optional(S.String),
    subtitle: optional(S.String),
    title: TitlePathSegment,
  },
  $I.annote("EcfrVersionerParams", {
    description: "Dated CFR title path and optional hierarchy selectors for eCFR versioner requests.",
  })
) {}

/**
 * Dated CFR title path parameters for versioner requests that accept no
 * hierarchy selectors (the official structure endpoint takes only `date` and
 * `title`).
 *
 * **Example** (Make dated title path params)
 *
 * ```ts
 * import { EcfrDatedTitleParams } from "@beep/ecfr"
 *
 * const params = EcfrDatedTitleParams.make({ date: "2026-07-01", title: "1" })
 * console.log(params.title)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EcfrDatedTitleParams extends S.Class<EcfrDatedTitleParams>($I`EcfrDatedTitleParams`)(
  {
    date: DatePathSegment,
    title: TitlePathSegment,
  },
  $I.annote("EcfrDatedTitleParams", {
    description: "Dated CFR title path parameters for eCFR versioner requests without hierarchy selectors.",
  })
) {}

/**
 * Filters for listing dated content versions within one CFR title.
 *
 * **Example** (Make versions params with date filter)
 *
 * ```ts
 * import { EcfrVersionsParams } from "@beep/ecfr"
 * import * as O from "effect/Option"
 *
 * const params = EcfrVersionsParams.make({ title: "1", issueDateGte: O.some("2026-01-01") })
 * console.log(params.title)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EcfrVersionsParams extends S.Class<EcfrVersionsParams>($I`EcfrVersionsParams`)(
  {
    appendix: optional(S.String),
    chapter: optional(S.String),
    issueDateGte: optional(S.String),
    issueDateLte: optional(S.String),
    issueDateOn: optional(S.String),
    page: optional(NonNegativeInt),
    part: optional(S.String),
    section: optional(S.String),
    subchapter: optional(S.String),
    subpart: optional(S.String),
    subtitle: optional(S.String),
    title: TitlePathSegment,
  },
  $I.annote("EcfrVersionsParams", {
    description: "Issue-date, page, and hierarchy filters for one CFR title's content versions.",
  })
) {}

/**
 * One decoded search-result item from the generated eCFR response envelope.
 *
 * @see {@link G.SearchResultsResponse} for the generated runtime response schema.
 * @category models
 * @since 0.0.0
 */
export type SearchResult = G.SearchResultsResponse["results"][number];

/**
 * Public service shape for the keyless eCFR driver.
 *
 * **Example** (Stub listTitles on EcfrShape)
 *
 * ```ts
 * import { Effect } from "effect"
 * import type { EcfrShape } from "@beep/ecfr"
 *
 * const shape: Pick<EcfrShape, "listTitles"> = {
 *   listTitles: Effect.die("example")
 * }
 * console.log(typeof shape.listTitles)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export interface EcfrShape {
  readonly getAncestry: (params: EcfrVersionerParams) => Effect.Effect<G.AncestryResponse, EcfrError>;
  readonly getFullTitleXml: (params: EcfrVersionerParams) => Effect.Effect<string, EcfrError>;
  readonly getStructure: (params: EcfrDatedTitleParams) => Effect.Effect<G.StructureNode, EcfrError>;
  readonly listAgencies: Effect.Effect<G.AgenciesResponse, EcfrError>;
  readonly listCorrections: (params?: EcfrCorrectionsParams) => Effect.Effect<G.CorrectionsResponse, EcfrError>;
  readonly listTitleCorrections: (params: EcfrTitleParams) => Effect.Effect<G.CorrectionsResponse, EcfrError>;
  readonly listTitles: Effect.Effect<G.TitlesResponse, EcfrError>;
  readonly listVersions: (params: EcfrVersionsParams) => Effect.Effect<G.VersionsResponse, EcfrError>;
  readonly rateLimit: Effect.Effect<O.Option<RateLimitSnapshot>>;
  readonly searchCount: (params?: EcfrSearchParams) => Effect.Effect<G.SearchCountResponse, EcfrError>;
  readonly searchDailyCounts: (params?: EcfrSearchParams) => Effect.Effect<G.SearchDailyCountsResponse, EcfrError>;
  readonly searchHierarchyCounts: (
    params?: EcfrSearchParams
  ) => Effect.Effect<G.SearchHierarchyCountsResponse, EcfrError>;
  readonly searchResults: (params?: EcfrSearchParams) => Effect.Effect<G.SearchResultsResponse, EcfrError>;
  readonly searchResultsAll: (params?: EcfrSearchParams) => Stream.Stream<SearchResult, EcfrError>;
  readonly searchSuggestions: (params?: EcfrSearchParams) => Effect.Effect<G.SearchSuggestionsResponse, EcfrError>;
  readonly searchSummary: (params?: EcfrSearchParams) => Effect.Effect<G.SearchSummaryResponse, EcfrError>;
  readonly searchTitleCounts: (params?: EcfrSearchParams) => Effect.Effect<G.SearchTitleCountsResponse, EcfrError>;
}

class ResolvedConfig extends S.Class<ResolvedConfig>($I`ResolvedConfig`)(
  {
    apiUrl: URLStr,
  },
  $I.annote("ResolvedConfig", {
    description: "Configuration for the eCFR driver.",
  })
) {}

const resolveConfig = (input: EcfrConfigInput): ResolvedConfig => ({
  apiUrl: URLStr.make(input.apiUrl),
});

const requestError = (cause: unknown): EcfrError =>
  EcfrError.of("request encoding", EcfrErrorOptions.make({ cause: O.some(cause) }));

const responseDecodingError = (cause: unknown): EcfrError =>
  EcfrError.of("response decoding", EcfrErrorOptions.make({ cause: O.some(cause) }));

const validateRequest = Effect.fnUntraced(function* <C extends S.Constraint>(schema: C, input: C["Type"]) {
  yield* S.encodeEffect(schema)(input).pipe(Effect.mapError(requestError));
  return input;
});

const toSearchQuery = (params: EcfrSearchParams, page: O.Option<number> = params.page): G.SearchResultsQuery =>
  O.getSomesStruct({
    "agency_slugs[]": params.agencySlugs,
    date: params.date,
    last_modified_after: params.lastModifiedAfter,
    last_modified_before: params.lastModifiedBefore,
    last_modified_on_or_after: params.lastModifiedOnOrAfter,
    last_modified_on_or_before: params.lastModifiedOnOrBefore,
    order: params.order,
    page,
    paginate_by: params.paginateBy,
    per_page: params.perPage,
    query: params.query,
  });

const toHierarchyQuery = (params: EcfrVersionerParams | EcfrVersionsParams): G.GetAncestryQuery =>
  O.getSomesStruct({
    appendix: params.appendix,
    chapter: params.chapter,
    part: params.part,
    section: params.section,
    subchapter: params.subchapter,
    subpart: params.subpart,
    subtitle: params.subtitle,
  });

class StatusCause extends S.Class<StatusCause>($I`StatusCause`)(
  {
    response: S.Struct({ status: NonNegativeInt }),
  },
  $I.annote("StatusCause", {
    description: "External HTTP client failure carrying a numeric response status.",
  })
) {}

const decodeStatusCause = S.decodeUnknownOption(StatusCause);
const readStatus = (cause: HttpClientError.HttpClientError): O.Option<NonNegativeInt> =>
  O.map(decodeStatusCause(cause), ({ response }) => response.status);

const mapHttpClientError = (cause: HttpClientError.HttpClientError): EcfrError =>
  O.match(readStatus(cause), {
    onNone: () => EcfrError.of("transport", EcfrErrorOptions.make({ cause: O.some(cause) })),
    onSome: (status) =>
      EcfrError.of("response status", EcfrErrorOptions.make({ cause: O.some(cause), status: O.some(status) })),
  });

const mapClientError = Match.type<HttpClientError.HttpClientError | S.SchemaError>().pipe(
  Match.when(S.isSchemaError, responseDecodingError),
  Match.orElse(mapHttpClientError)
);

const makeFromResolved = Effect.fnUntraced(function* (config: ResolvedConfig) {
  const transport = yield* makeApiTransport({
    auth: ApiAuth.NoAuth(),
    key: "ecfr",
    rateLimit: { limit: ECFR_RATE_LIMIT, window: ECFR_RATE_LIMIT_WINDOW },
  });

  const client = yield* HttpApiClient.make(G.Ecfr, {
    baseUrl: config.apiUrl,
    transformClient: transport.transformClient,
  });
  const call = Effect.mapError(mapClientError);

  const searchResults = Effect.fn("Ecfr.searchResults")(function* (
    params = EcfrSearchParams.make({})
  ): Effect.fn.Return<G.SearchResultsResponse, EcfrError> {
    const decoded = yield* validateRequest(EcfrSearchParams, params);
    return yield* call(client.searchResults({ query: toSearchQuery(decoded) }));
  });

  return Ecfr.of({
    getAncestry: Effect.fn("Ecfr.getAncestry")(function* (params) {
      const decoded = yield* validateRequest(EcfrVersionerParams, params);
      return yield* call(
        client.getAncestry({
          params: { date: decoded.date, title: decoded.title },
          query: toHierarchyQuery(decoded),
        })
      );
    }),
    getFullTitleXml: Effect.fn("Ecfr.getFullTitleXml")(function* (params) {
      const decoded = yield* validateRequest(EcfrVersionerParams, params);
      return yield* call(
        client.getFullTitleXml({
          params: { date: decoded.date, title: decoded.title },
          query: toHierarchyQuery(decoded),
        })
      );
    }),
    getStructure: Effect.fn("Ecfr.getStructure")(function* (params) {
      const decoded = yield* validateRequest(EcfrDatedTitleParams, params);
      return yield* call(client.getStructure({ params: { date: decoded.date, title: decoded.title }, query: {} }));
    }),
    listAgencies: call(client.listAgencies({})),
    listCorrections: Effect.fn("Ecfr.listCorrections")(function* (params = EcfrCorrectionsParams.make({})) {
      const decoded = yield* validateRequest(EcfrCorrectionsParams, params);
      return yield* call(
        client.listCorrections({
          query: O.getSomesStruct({
            date: decoded.date,
            error_corrected_date: decoded.errorCorrectedDate,
            title: decoded.title,
          }),
        })
      );
    }),
    listTitleCorrections: Effect.fn("Ecfr.listTitleCorrections")(function* (params) {
      const decoded = yield* validateRequest(EcfrTitleParams, params);
      return yield* call(client.listTitleCorrections({ params: { title: decoded.title } }));
    }),
    listTitles: call(client.listTitles({})),
    listVersions: Effect.fn("Ecfr.listVersions")(function* (params) {
      const decoded = yield* validateRequest(EcfrVersionsParams, params);
      return yield* call(
        client.listVersions({
          params: { title: decoded.title },
          query: {
            ...toHierarchyQuery(decoded),
            ...O.getSomesStruct({
              "issue_date[gte]": decoded.issueDateGte,
              "issue_date[lte]": decoded.issueDateLte,
              "issue_date[on]": decoded.issueDateOn,
              page: decoded.page,
            }),
          },
        })
      );
    }),
    rateLimit: transport.rateLimit,
    searchCount: Effect.fn("Ecfr.searchCount")(function* (params = EcfrSearchParams.make({})) {
      const decoded = yield* validateRequest(EcfrSearchParams, params);
      return yield* call(client.searchCount({ query: toSearchQuery(decoded) }));
    }),
    searchDailyCounts: Effect.fn("Ecfr.searchDailyCounts")(function* (params = EcfrSearchParams.make({})) {
      const decoded = yield* validateRequest(EcfrSearchParams, params);
      return yield* call(client.searchDailyCounts({ query: toSearchQuery(decoded) }));
    }),
    searchHierarchyCounts: Effect.fn("Ecfr.searchHierarchyCounts")(function* (params = EcfrSearchParams.make({})) {
      const decoded = yield* validateRequest(EcfrSearchParams, params);
      return yield* call(client.searchHierarchyCounts({ query: toSearchQuery(decoded) }));
    }),
    searchResults,
    searchResultsAll: (params = EcfrSearchParams.make({})) =>
      Stream.paginate(1, (page) =>
        validateRequest(EcfrSearchParams, params).pipe(
          Effect.flatMap((decoded) => call(client.searchResults({ query: toSearchQuery(decoded, O.some(page)) }))),
          Effect.map(
            (response) =>
              [
                response.results,
                response.meta.current_page < response.meta.total_pages ? O.some(page + 1) : O.none<number>(),
              ] as const
          )
        )
      ),
    searchSummary: Effect.fn("Ecfr.searchSummary")(function* (params = EcfrSearchParams.make({})) {
      const decoded = yield* validateRequest(EcfrSearchParams, params);
      return yield* call(client.searchSummary({ query: toSearchQuery(decoded) }));
    }),
    searchSuggestions: Effect.fn("Ecfr.searchSuggestions")(function* (params = EcfrSearchParams.make({})) {
      const decoded = yield* validateRequest(EcfrSearchParams, params);
      return yield* call(client.searchSuggestions({ query: toSearchQuery(decoded) }));
    }),
    searchTitleCounts: Effect.fn("Ecfr.searchTitleCounts")(function* (params = EcfrSearchParams.make({})) {
      const decoded = yield* validateRequest(EcfrSearchParams, params);
      return yield* call(client.searchTitleCounts({ query: toSearchQuery(decoded) }));
    }),
  });
});

const makeFromEnvironment = Effect.fnUntraced(function* () {
  const apiUrl = yield* Config.string("ECFR_API_URL").pipe(Config.withDefault(ECFR_API_URL));
  return yield* makeFromResolved({ apiUrl: URLStr.make(apiUrl) });
});

/**
 * Effect service for the keyless eCFR versioner API.
 *
 * **Example** (Access Ecfr via Effect.gen)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { Ecfr } from "@beep/ecfr"
 *
 * const program = Effect.gen(function* () {
 *   const ecfr = yield* Ecfr
 *   return yield* ecfr.listTitles
 * })
 *
 * void program
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class Ecfr extends Context.Service<Ecfr, EcfrShape>()($I`Ecfr`) {
  /**
   * Build an eCFR layer from explicit runtime configuration.
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly makeLayer = (
    config = EcfrConfigInput.make({})
  ): Layer.Layer<Ecfr, never, HttpClient.HttpClient | RateLimiter.RateLimiterStore> =>
    Layer.effect(Ecfr, makeFromResolved(resolveConfig(config)));

  /**
   * Live eCFR layer backed by the platform `fetch` client and an in-memory
   * rate-limiter store. Keyless: no credentials are read or attached.
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layer: Layer.Layer<Ecfr, EcfrError> = Layer.effect(
    Ecfr,
    makeFromEnvironment().pipe(Effect.mapError(EcfrError.config))
  ).pipe(Layer.provide(FetchHttpClient.layer), Layer.provide(RateLimiter.layerStoreMemory));
}
