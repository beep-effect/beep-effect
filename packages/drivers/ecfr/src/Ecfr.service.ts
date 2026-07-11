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
import { Config, Context, Effect, Layer, pipe, Stream } from "effect";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { FetchHttpClient } from "effect/unstable/http";
import * as HttpClient from "effect/unstable/http/HttpClient";
import * as HttpClientRequest from "effect/unstable/http/HttpClientRequest";
import * as RateLimiter from "effect/unstable/persistence/RateLimiter";
import * as G from "./_generated/Ecfr.generated.ts";
import { ECFR_API_URL, ECFR_RATE_LIMIT, ECFR_RATE_LIMIT_WINDOW, EcfrConfigInput } from "./Ecfr.config.ts";
import { EcfrError, EcfrErrorOptions } from "./Ecfr.errors.ts";
import type { RateLimitSnapshot } from "@beep/api-transport";
import type { EcfrOperationDescriptor } from "./_generated/Ecfr.generated.ts";

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
const optional = <A, I, R>(schema: S.Codec<A, I, R>) =>
  S.OptionFromOptionalKey(schema).pipe(SchemaUtils.withNoneDefault);

/**
 * Optional filters accepted by the eCFR corrections listing endpoint.
 *
 * @example
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
 * @example
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
  { title: S.String },
  $I.annote("EcfrTitleParams", { description: "Path parameters identifying one CFR title." })
) {}

/**
 * Filters and page controls shared by the eCFR search family.
 *
 * @example
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
 * @example
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
    date: S.String,
    part: optional(S.String),
    section: optional(S.String),
    subchapter: optional(S.String),
    subpart: optional(S.String),
    subtitle: optional(S.String),
    title: S.String,
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
 * @example
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
    date: S.String,
    title: S.String,
  },
  $I.annote("EcfrDatedTitleParams", {
    description: "Dated CFR title path parameters for eCFR versioner requests without hierarchy selectors.",
  })
) {}

/**
 * Filters for listing dated content versions within one CFR title.
 *
 * @example
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
    title: S.String,
  },
  $I.annote("EcfrVersionsParams", {
    description: "Issue-date, page, and hierarchy filters for one CFR title's content versions.",
  })
) {}

/**
 * Public service shape for the keyless eCFR driver.
 *
 * @example
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
  readonly searchResultsAll: (params?: EcfrSearchParams) => Stream.Stream<G.SearchResult, EcfrError>;
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

const decodeStatusOption = S.decodeUnknownOption(NonNegativeInt);

const requestError = (cause: unknown): EcfrError =>
  EcfrError.of("request encoding", EcfrErrorOptions.make({ cause: O.some(cause) }));

const responseDecodingError = (cause: unknown): EcfrError =>
  EcfrError.of("response decoding", EcfrErrorOptions.make({ cause: O.some(cause) }));

const setOptionalUrlParam = <A>(
  request: HttpClientRequest.HttpClientRequest,
  key: string,
  value: O.Option<A>,
  render: (value: A) => string
): HttpClientRequest.HttpClientRequest =>
  pipe(
    value,
    O.map((item) => HttpClientRequest.setUrlParam(request, key, render(item))),
    O.getOrElse(() => request)
  );

const setOptionalString = (
  request: HttpClientRequest.HttpClientRequest,
  key: string,
  value: O.Option<string>
): HttpClientRequest.HttpClientRequest => setOptionalUrlParam(request, key, value, (item) => item);

const setOptionalInt = (
  request: HttpClientRequest.HttpClientRequest,
  key: string,
  value: O.Option<NonNegativeInt>
): HttpClientRequest.HttpClientRequest => setOptionalUrlParam(request, key, value, (item) => `${item}`);

const addSearchQuery = (
  request: HttpClientRequest.HttpClientRequest,
  params: EcfrSearchParams,
  pageOverride: O.Option<number> = O.none()
): HttpClientRequest.HttpClientRequest => {
  const withAgencies = pipe(
    params.agencySlugs,
    O.map((slugs) =>
      A.reduce(slugs, request, (current, slug) => HttpClientRequest.appendUrlParam(current, "agency_slugs[]", slug))
    ),
    O.getOrElse(() => request)
  );
  const withPage = pipe(
    pageOverride,
    O.map((page) => HttpClientRequest.setUrlParam(withAgencies, "page", `${page}`)),
    O.getOrElse(() => setOptionalInt(withAgencies, "page", params.page))
  );
  return pipe(
    setOptionalString(withPage, "query", params.query),
    (current) => setOptionalString(current, "date", params.date),
    (current) => setOptionalString(current, "last_modified_after", params.lastModifiedAfter),
    (current) => setOptionalString(current, "last_modified_before", params.lastModifiedBefore),
    (current) => setOptionalString(current, "last_modified_on_or_after", params.lastModifiedOnOrAfter),
    (current) => setOptionalString(current, "last_modified_on_or_before", params.lastModifiedOnOrBefore),
    (current) => setOptionalString(current, "order", params.order),
    (current) => setOptionalString(current, "paginate_by", params.paginateBy),
    (current) => setOptionalInt(current, "per_page", params.perPage)
  );
};

const hierarchyPath = (path: string, params: { readonly date: string; readonly title: string }): string =>
  pipe(
    path,
    Str.replace("{date}", encodeURIComponent(params.date)),
    Str.replace("{title}", encodeURIComponent(params.title))
  );

const addHierarchyQuery = (
  request: HttpClientRequest.HttpClientRequest,
  params: EcfrVersionerParams | EcfrVersionsParams
): HttpClientRequest.HttpClientRequest =>
  pipe(
    setOptionalString(request, "subtitle", params.subtitle),
    (current) => setOptionalString(current, "chapter", params.chapter),
    (current) => setOptionalString(current, "subchapter", params.subchapter),
    (current) => setOptionalString(current, "part", params.part),
    (current) => setOptionalString(current, "subpart", params.subpart),
    (current) => setOptionalString(current, "section", params.section),
    (current) => setOptionalString(current, "appendix", params.appendix)
  );

const makeFromResolved = Effect.fnUntraced(function* (config: ResolvedConfig) {
  const transport = yield* makeApiTransport({
    auth: ApiAuth.NoAuth(),
    key: "ecfr",
    rateLimit: { limit: ECFR_RATE_LIMIT, window: ECFR_RATE_LIMIT_WINDOW },
  });

  const httpClient = yield* HttpClient.HttpClient;
  const client = httpClient.pipe(
    transport.transformClient,
    HttpClient.mapRequest(HttpClientRequest.prependUrl(config.apiUrl))
  );

  const execute = Effect.fnUntraced(function* (request: HttpClientRequest.HttpClientRequest) {
    const response = yield* client
      .execute(request)
      .pipe(Effect.mapError((cause) => EcfrError.of("transport", EcfrErrorOptions.make({ cause: O.some(cause) }))));

    if (response.status < 200 || response.status >= 300) {
      return yield* EcfrError.of(
        "response status",
        EcfrErrorOptions.make({ status: decodeStatusOption(response.status) })
      );
    }
    return response;
  });

  const runJson = Effect.fnUntraced(function* <A>(
    descriptor: EcfrOperationDescriptor,
    decode: (input: unknown) => Effect.Effect<A, S.SchemaError>,
    request = HttpClientRequest.get(descriptor.path)
  ): Effect.fn.Return<A, EcfrError> {
    const response = yield* execute(request);
    const body = yield* response.json.pipe(Effect.mapError(responseDecodingError));
    return yield* decode(body).pipe(
      Effect.mapError(responseDecodingError),
      Effect.withSpan(`Ecfr.${descriptor.operationId}`)
    );
  });

  const runText = Effect.fnUntraced(function* (
    descriptor: EcfrOperationDescriptor,
    request: HttpClientRequest.HttpClientRequest
  ) {
    const response = yield* execute(request);
    return yield* response.text.pipe(
      Effect.mapError(responseDecodingError),
      Effect.withSpan(`Ecfr.${descriptor.operationId}`)
    );
  });

  const decodeSearchParams = (params: EcfrSearchParams): Effect.Effect<EcfrSearchParams, EcfrError> =>
    S.encodeUnknownEffect(EcfrSearchParams)(params).pipe(Effect.as(params), Effect.mapError(requestError));

  const runSearch = Effect.fnUntraced(function* <A>(
    descriptor: G.EcfrOperationDescriptor,
    response: S.Codec<A>,
    params: EcfrSearchParams,
    pageOverride = O.none<number>()
  ) {
    const decoded = yield* decodeSearchParams(params);
    const request = addSearchQuery(HttpClientRequest.get(descriptor.path), decoded, pageOverride);
    return yield* runJson(descriptor, S.decodeUnknownEffect(response), request);
  });

  const searchResults = Effect.fn("Ecfr.searchResults")(function* (
    params = EcfrSearchParams.make({})
  ): Effect.fn.Return<G.SearchResultsResponse, EcfrError> {
    return yield* runSearch(G.ECFR_OPERATIONS.searchResults.descriptor, G.SearchResultsResponse, params);
  });

  return Ecfr.of({
    getAncestry: Effect.fn("Ecfr.getAncestry")(function* (params) {
      const decoded = yield* S.encodeUnknownEffect(EcfrVersionerParams)(params).pipe(
        Effect.as(params),
        Effect.mapError(requestError)
      );
      const descriptor = G.ECFR_OPERATIONS.getAncestry.descriptor;
      const request = addHierarchyQuery(HttpClientRequest.get(hierarchyPath(descriptor.path, decoded)), decoded);
      return yield* runJson(descriptor, S.decodeUnknownEffect(G.AncestryResponse), request);
    }),
    getFullTitleXml: Effect.fn("Ecfr.getFullTitleXml")(function* (params) {
      const decoded = yield* S.encodeUnknownEffect(EcfrVersionerParams)(params).pipe(
        Effect.as(params),
        Effect.mapError(requestError)
      );
      const descriptor = G.ECFR_OPERATIONS.getFullTitleXml.descriptor;
      const request = addHierarchyQuery(HttpClientRequest.get(hierarchyPath(descriptor.path, decoded)), decoded);
      return yield* runText(descriptor, request);
    }),
    getStructure: Effect.fn("Ecfr.getStructure")(function* (params) {
      const decoded = yield* S.encodeUnknownEffect(EcfrDatedTitleParams)(params).pipe(
        Effect.as(params),
        Effect.mapError(requestError)
      );
      const descriptor = G.ECFR_OPERATIONS.getStructure.descriptor;
      return yield* runJson(
        descriptor,
        S.decodeUnknownEffect(G.StructureNode),
        HttpClientRequest.get(hierarchyPath(descriptor.path, decoded))
      );
    }),
    listAgencies: runJson(G.ECFR_OPERATIONS.listAgencies.descriptor, S.decodeUnknownEffect(G.AgenciesResponse)),
    listCorrections: Effect.fn("Ecfr.listCorrections")(function* (params = EcfrCorrectionsParams.make({})) {
      const decoded = yield* S.encodeUnknownEffect(EcfrCorrectionsParams)(params).pipe(
        Effect.as(params),
        Effect.mapError(requestError)
      );
      const descriptor = G.ECFR_OPERATIONS.listCorrections.descriptor;
      const request = pipe(
        setOptionalString(HttpClientRequest.get(descriptor.path), "date", decoded.date),
        (current) => setOptionalString(current, "title", decoded.title),
        (current) => setOptionalString(current, "error_corrected_date", decoded.errorCorrectedDate)
      );
      return yield* runJson(descriptor, S.decodeUnknownEffect(G.CorrectionsResponse), request);
    }),
    listTitleCorrections: Effect.fn("Ecfr.listTitleCorrections")(function* (params) {
      const decoded = yield* S.encodeUnknownEffect(EcfrTitleParams)(params).pipe(
        Effect.as(params),
        Effect.mapError(requestError)
      );
      const descriptor = G.ECFR_OPERATIONS.listTitleCorrections.descriptor;
      const path = pipe(descriptor.path, Str.replace("{title}", encodeURIComponent(decoded.title)));
      return yield* runJson(descriptor, S.decodeUnknownEffect(G.CorrectionsResponse), HttpClientRequest.get(path));
    }),
    listTitles: runJson(G.ECFR_OPERATIONS.listTitles.descriptor, S.decodeUnknownEffect(G.TitlesResponse)),
    listVersions: Effect.fn("Ecfr.listVersions")(function* (params) {
      const decoded = yield* S.encodeUnknownEffect(EcfrVersionsParams)(params).pipe(
        Effect.as(params),
        Effect.mapError(requestError)
      );
      const descriptor = G.ECFR_OPERATIONS.listVersions.descriptor;
      const withHierarchy = addHierarchyQuery(
        HttpClientRequest.get(pipe(descriptor.path, Str.replace("{title}", encodeURIComponent(decoded.title)))),
        decoded
      );
      const request = pipe(
        setOptionalString(withHierarchy, "issue_date[on]", decoded.issueDateOn),
        (current) => setOptionalString(current, "issue_date[lte]", decoded.issueDateLte),
        (current) => setOptionalString(current, "issue_date[gte]", decoded.issueDateGte),
        (current) => setOptionalInt(current, "page", decoded.page)
      );
      return yield* runJson(descriptor, S.decodeUnknownEffect(G.VersionsResponse), request);
    }),
    rateLimit: transport.rateLimit,
    searchCount: Effect.fn("Ecfr.searchCount")(function* (params = EcfrSearchParams.make({})) {
      return yield* runSearch(G.ECFR_OPERATIONS.searchCount.descriptor, G.SearchCountResponse, params);
    }),
    searchDailyCounts: Effect.fn("Ecfr.searchDailyCounts")(function* (params = EcfrSearchParams.make({})) {
      return yield* runSearch(G.ECFR_OPERATIONS.searchDailyCounts.descriptor, G.SearchDailyCountsResponse, params);
    }),
    searchHierarchyCounts: Effect.fn("Ecfr.searchHierarchyCounts")(function* (params = EcfrSearchParams.make({})) {
      return yield* runSearch(
        G.ECFR_OPERATIONS.searchHierarchyCounts.descriptor,
        G.SearchHierarchyCountsResponse,
        params
      );
    }),
    searchResults,
    searchResultsAll: (params = EcfrSearchParams.make({})) =>
      Stream.paginate(1, (page) =>
        runSearch(G.ECFR_OPERATIONS.searchResults.descriptor, G.SearchResultsResponse, params, O.some(page)).pipe(
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
      return yield* runSearch(G.ECFR_OPERATIONS.searchSummary.descriptor, G.SearchSummaryResponse, params);
    }),
    searchSuggestions: Effect.fn("Ecfr.searchSuggestions")(function* (params = EcfrSearchParams.make({})) {
      return yield* runSearch(G.ECFR_OPERATIONS.searchSuggestions.descriptor, G.SearchSuggestionsResponse, params);
    }),
    searchTitleCounts: Effect.fn("Ecfr.searchTitleCounts")(function* (params = EcfrSearchParams.make({})) {
      return yield* runSearch(G.ECFR_OPERATIONS.searchTitleCounts.descriptor, G.SearchTitleCountsResponse, params);
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
 * @example
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
