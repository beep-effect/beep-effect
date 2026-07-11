import {
  AgenciesResponse,
  CorrectionsResponse,
  ECFR_API_URL,
  Ecfr,
  EcfrConfigInput,
  EcfrCorrectionsParams,
  EcfrDatedTitleParams,
  EcfrError,
  EcfrErrorOptions,
  EcfrErrorReason,
  EcfrSearchParams,
  EcfrTitleParams,
  EcfrVersionerParams,
  EcfrVersionsParams,
  SearchResultsResponse,
  StructureNode,
  VersionsResponse,
} from "@beep/ecfr";
import { $EcfrId } from "@beep/identity";
import { NonNegativeInt } from "@beep/schema";
import { fcRuns } from "@beep/test-utils";
import { O } from "@beep/utils";
import { describe, expect, it, layer } from "@effect/vitest";
import { Context, Effect, Layer, Match, pipe, Ref, Result } from "effect";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import { FastCheck as fc } from "effect/testing";
import * as HttpClient from "effect/unstable/http/HttpClient";
import * as HttpClientRequest from "effect/unstable/http/HttpClientRequest";
import * as HttpClientResponse from "effect/unstable/http/HttpClientResponse";
import * as RateLimiter from "effect/unstable/persistence/RateLimiter";

const $TestI = $EcfrId.create("Ecfr.service.test");

type CapturedRequest = {
  readonly method: string;
  readonly url: string;
};

type EcfrTestHttpShape = {
  readonly captures: Effect.Effect<ReadonlyArray<CapturedRequest>>;
  readonly handle: (request: HttpClientRequest.HttpClientRequest) => Effect.Effect<Response>;
};

class EcfrTestHttp extends Context.Service<EcfrTestHttp, EcfrTestHttpShape>()($TestI`EcfrTestHttp`) {}

const EcfrConfigInputArbitrary = S.toArbitrary(EcfrConfigInput);
const EcfrErrorReasonArbitrary = S.toArbitrary(EcfrErrorReason);
const EcfrErrorOptionsArbitrary = S.toArbitrary(EcfrErrorOptions).map((options) =>
  EcfrErrorOptions.make({ status: options.status })
);
const EcfrErrorArbitrary = S.toArbitrary(EcfrError).map((error) =>
  EcfrError.of(error.reason, EcfrErrorOptions.make({ status: error.status }))
);
const AgenciesResponseArbitrary = S.toArbitrary(AgenciesResponse);
const CorrectionsResponseArbitrary = S.toArbitrary(CorrectionsResponse);
const SearchResultsResponseArbitrary = S.toArbitrary(SearchResultsResponse);
const StructureNodeArbitrary = S.toArbitrary(StructureNode);
const VersionsResponseArbitrary = S.toArbitrary(VersionsResponse);

const encode = <Codec extends S.Codec<unknown, unknown>>(schema: Codec, value: Codec["Type"]): Codec["Encoded"] =>
  Result.getOrThrow(S.encodeResult(schema)(value));

const decode = <Codec extends S.Codec<unknown, unknown>>(schema: Codec, value: Codec["Encoded"]): Codec["Type"] =>
  Result.getOrThrow(S.decodeUnknownResult(schema)(value));

const expectRoundTrip = <Codec extends S.Codec<unknown, unknown>>(schema: Codec, value: Codec["Type"]): void => {
  const encoded = encode(schema, value);
  const decoded = decode(schema, encoded);
  const reencoded = encode(schema, decoded);

  expect(reencoded).toEqual(encoded);
  expect(S.toEquivalence(schema)(decoded, value)).toBe(true);
};

const titlesBody = {
  titles: [
    {
      latest_amended_on: "2022-12-29",
      latest_issue_date: "2024-05-17",
      name: "General Provisions",
      number: 1,
      reserved: false,
      up_to_date_as_of: "2026-06-29",
    },
  ],
};

const responseFor = (url: string): Response =>
  Match.value(url).pipe(
    Match.when(Str.includes("/api/admin/v1/agencies.json"), () =>
      Response.json({ agencies: [{ name: "Example Agency", slug: "example-agency" }] })
    ),
    Match.when(Str.includes("/api/admin/v1/corrections"), () =>
      Response.json({ ecfr_corrections: [{ id: 1, title: 1 }] })
    ),
    Match.when(Str.includes("/api/search/v1/results"), () => {
      const secondPage = Str.includes("page=2")(url);
      return Response.json({
        meta: { current_page: secondPage ? 2 : 1, total_count: 2, total_pages: 2 },
        results: [{ full_text_excerpt: secondPage ? "second" : "first" }],
      });
    }),
    Match.when(Str.includes("/api/search/v1/counts/daily"), () => Response.json({ counts: [] })),
    Match.when(Str.includes("/api/search/v1/counts/titles"), () => Response.json({ counts: [] })),
    Match.when(Str.includes("/api/search/v1/counts/hierarchy"), () => Response.json({ counts: [] })),
    Match.when(Str.includes("/api/search/v1/count"), () => Response.json({ count: 2 })),
    Match.when(Str.includes("/api/search/v1/summary"), () => Response.json({ count: 2 })),
    Match.when(Str.includes("/api/search/v1/suggestions"), () => Response.json({ suggestions: ["water"] })),
    Match.when(Str.includes("/api/versioner/v1/ancestry"), () =>
      Response.json([{ identifier: "1", label: "Title 1", type: "title" }])
    ),
    Match.when(
      Str.includes("/api/versioner/v1/full"),
      () => new Response("<ECFR><TITLE>1</TITLE></ECFR>", { headers: { "content-type": "application/xml" } })
    ),
    Match.when(Str.includes("/api/versioner/v1/structure"), () =>
      Response.json({ identifier: "1", label: "Title 1", type: "title" })
    ),
    Match.when(Str.includes("/api/versioner/v1/titles.json"), () => Response.json(titlesBody)),
    Match.when(Str.includes("/api/versioner/v1/versions"), () => Response.json({ content_versions: [], meta: {} })),
    Match.orElse(() => Response.json({}, { status: 404 }))
  );

const EcfrTestHttpLayer = Layer.effect(
  EcfrTestHttp,
  Effect.gen(function* () {
    const capturesRef = yield* Ref.make<ReadonlyArray<CapturedRequest>>([]);
    return EcfrTestHttp.of({
      captures: Ref.get(capturesRef),
      handle: Effect.fn("EcfrTestHttp.handle")(function* (request) {
        const url = pipe(
          HttpClientRequest.toUrl(request),
          O.map((value) => value.toString()),
          O.getOrElse(() => request.url)
        );
        yield* Ref.update(capturesRef, (xs) => [...xs, { method: request.method, url }]);
        return responseFor(url);
      }),
    });
  })
);

const TestHttpClientLayer = Layer.effect(
  HttpClient.HttpClient,
  Effect.gen(function* () {
    const testHttp = yield* EcfrTestHttp;
    return HttpClient.make((request) =>
      Effect.gen(function* () {
        const response = yield* testHttp.handle(request);
        return HttpClientResponse.fromWeb(request, response);
      })
    );
  })
);

const makeEcfrUnitLayer = (config = EcfrConfigInput.make({})) =>
  Ecfr.makeLayer(config).pipe(
    Layer.provide(TestHttpClientLayer),
    Layer.provideMerge(EcfrTestHttpLayer),
    Layer.provide(RateLimiter.layerStoreMemory)
  );

describe("@beep/ecfr", () => {
  it("keeps hand-authored schema encoded shapes stable", () => {
    expect(encode(EcfrConfigInput, EcfrConfigInput.make({ apiUrl: ECFR_API_URL }))).toEqual({
      apiUrl: ECFR_API_URL,
    });
    expect(encode(EcfrErrorOptions, EcfrErrorOptions.make({}))).toEqual({});
    expect(encode(EcfrErrorOptions, EcfrErrorOptions.make({ status: O.some(NonNegativeInt.make(503)) }))).toEqual({
      status: 503,
    });
    expect(
      encode(
        EcfrError,
        EcfrError.of("response status", EcfrErrorOptions.make({ status: O.some(NonNegativeInt.make(503)) }))
      )
    ).toEqual({
      _tag: "EcfrError",
      reason: "response status",
      status: 503,
    });
    expect(EcfrConfigInput.make({}).apiUrl).toBe(ECFR_API_URL);
  });

  it("round-trips hand-authored schema-derived values through encoded form", () =>
    fc.assert(
      fc.property(
        EcfrConfigInputArbitrary,
        EcfrErrorReasonArbitrary,
        EcfrErrorOptionsArbitrary,
        EcfrErrorArbitrary,
        (config, reason, options, error) => {
          expectRoundTrip(EcfrConfigInput, config);
          expectRoundTrip(EcfrErrorReason, reason);
          expectRoundTrip(EcfrErrorOptions, options);
          expectRoundTrip(EcfrError, error);
        }
      ),
      fcRuns(50)
    ));

  it("round-trips representative generated models through encoded form", () =>
    fc.assert(
      fc.property(
        AgenciesResponseArbitrary,
        CorrectionsResponseArbitrary,
        SearchResultsResponseArbitrary,
        StructureNodeArbitrary,
        VersionsResponseArbitrary,
        (agencies, corrections, searchResults, structure, versions) => {
          expectRoundTrip(AgenciesResponse, agencies);
          expectRoundTrip(CorrectionsResponse, corrections);
          expectRoundTrip(SearchResultsResponse, searchResults);
          expectRoundTrip(StructureNode, structure);
          expectRoundTrip(VersionsResponse, versions);
        }
      ),
      fcRuns(25)
    ));

  layer(makeEcfrUnitLayer())((it) =>
    it.effect(
      "decodes a keyless listTitles response offline via mapRequest base-URL prefixing",
      Effect.fnUntraced(function* () {
        const testHttp = yield* EcfrTestHttp;
        const ecfr = yield* Ecfr;

        const result = yield* ecfr.listTitles;
        const captures = yield* testHttp.captures;

        expect(result.titles).toHaveLength(1);
        expect(result.titles[0]?.number).toBe(1);
        expect(result.titles[0]?.name).toBe("General Provisions");
        expect(captures).toHaveLength(1);
        expect(captures[0]?.url).toBe("https://www.ecfr.gov/api/versioner/v1/titles.json");
        expect(captures[0]?.url ?? "").not.toContain("api_key");
      })
    )
  );

  layer(makeEcfrUnitLayer())((it) =>
    it.effect(
      "covers the admin operations with encoded paths and queries",
      Effect.fnUntraced(function* () {
        const testHttp = yield* EcfrTestHttp;
        const ecfr = yield* Ecfr;

        yield* ecfr.listAgencies;
        yield* ecfr.listCorrections(
          EcfrCorrectionsParams.make({
            date: O.some("2026-07-01"),
            errorCorrectedDate: O.some("2026-07-02"),
            title: O.some("1"),
          })
        );
        yield* ecfr.listTitleCorrections(EcfrTitleParams.make({ title: "7" }));

        const captures = yield* testHttp.captures;
        const urls = captures.map((capture) => capture.url);
        expect(captures).toHaveLength(3);
        expect(captures.every((capture) => capture.method === "GET")).toBe(true);
        expect(urls[0]).toBe("https://www.ecfr.gov/api/admin/v1/agencies.json");
        expect(urls[1]).toContain("/api/admin/v1/corrections.json?");
        expect(urls[1]).toContain("error_corrected_date=2026-07-02");
        expect(urls[2]).toBe("https://www.ecfr.gov/api/admin/v1/corrections/title/7.json");
      })
    )
  );

  layer(makeEcfrUnitLayer())((it) =>
    it.effect(
      "covers the search operations with encoded queries",
      Effect.fnUntraced(function* () {
        const testHttp = yield* EcfrTestHttp;
        const ecfr = yield* Ecfr;

        const search = EcfrSearchParams.make({
          agencySlugs: O.some(["example-agency", "second-agency"]),
          order: O.some("relevance"),
          page: O.some(NonNegativeInt.make(3)),
          paginateBy: O.some("results"),
          perPage: O.some(NonNegativeInt.make(25)),
          query: O.some("clean water"),
        });
        yield* ecfr.searchResults(search);
        yield* ecfr.searchCount(search);
        yield* ecfr.searchSummary(search);
        yield* ecfr.searchDailyCounts(search);
        yield* ecfr.searchTitleCounts(search);
        yield* ecfr.searchHierarchyCounts(search);
        yield* ecfr.searchSuggestions(search);

        const captures = yield* testHttp.captures;
        const urls = captures.map((capture) => capture.url);
        expect(captures).toHaveLength(7);
        expect(captures.every((capture) => capture.method === "GET")).toBe(true);
        expect(urls[0]).toContain("/api/search/v1/results?");
        expect(urls[0]).toContain("query=clean+water");
        expect(urls[0]).toContain("agency_slugs%5B%5D=example-agency");
        expect(urls[0]).toContain("agency_slugs%5B%5D=second-agency");
        expect(urls[0]).toContain("page=3");
        expect(urls[1]).toContain("/api/search/v1/count?");
        expect(urls[2]).toContain("/api/search/v1/summary?");
        expect(urls[3]).toContain("/api/search/v1/counts/daily?");
        expect(urls[4]).toContain("/api/search/v1/counts/titles?");
        expect(urls[5]).toContain("/api/search/v1/counts/hierarchy?");
        expect(urls[6]).toContain("/api/search/v1/suggestions?");
      })
    )
  );

  layer(makeEcfrUnitLayer())((it) =>
    it.effect(
      "covers the versioner operations with encoded paths and queries",
      Effect.fnUntraced(function* () {
        const testHttp = yield* EcfrTestHttp;
        const ecfr = yield* Ecfr;

        const versioner = EcfrVersionerParams.make({
          date: "2026-07-01",
          part: O.some("1"),
          section: O.some("1.1"),
          title: "1",
        });
        yield* ecfr.getAncestry(versioner);
        const xml = yield* ecfr.getFullTitleXml(versioner);
        yield* ecfr.getStructure(EcfrDatedTitleParams.make({ date: "2026-07-01", title: "1" }));
        yield* ecfr.listTitles;
        yield* ecfr.listVersions(
          EcfrVersionsParams.make({
            issueDateGte: O.some("2026-01-01"),
            page: O.some(NonNegativeInt.make(2)),
            part: O.some("1"),
            title: "1",
          })
        );

        const captures = yield* testHttp.captures;
        const urls = captures.map((capture) => capture.url);
        expect(captures).toHaveLength(5);
        expect(captures.every((capture) => capture.method === "GET")).toBe(true);
        expect(urls[0]).toContain("/api/versioner/v1/ancestry/2026-07-01/title-1.json?");
        expect(urls[0]).toContain("part=1");
        expect(urls[1]).toContain("/api/versioner/v1/full/2026-07-01/title-1.xml?");
        expect(urls[2]).toBe("https://www.ecfr.gov/api/versioner/v1/structure/2026-07-01/title-1.json");
        expect(urls[3]).toBe("https://www.ecfr.gov/api/versioner/v1/titles.json");
        expect(urls[4]).toContain("/api/versioner/v1/versions/title-1.json?");
        expect(urls[4]).toContain("issue_date%5Bgte%5D=2026-01-01");
        expect(urls[4]).toContain("page=2");
        expect(xml).toContain("<TITLE>1</TITLE>");
      })
    )
  );

  layer(makeEcfrUnitLayer())((it) =>
    it.effect(
      "streams successive search-result pages offline",
      Effect.fnUntraced(function* () {
        const testHttp = yield* EcfrTestHttp;
        const ecfr = yield* Ecfr;

        const results = yield* ecfr
          .searchResultsAll(EcfrSearchParams.make({ query: O.some("water"), perPage: O.some(NonNegativeInt.make(1)) }))
          .pipe(Stream.runCollect);
        const captures = yield* testHttp.captures;

        expect(results).toHaveLength(2);
        expect(results[0]?.full_text_excerpt).toBe("first");
        expect(results[1]?.full_text_excerpt).toBe("second");
        expect(captures).toHaveLength(2);
        expect(captures[0]?.url).toContain("page=1");
        expect(captures[1]?.url).toContain("page=2");
      })
    )
  );
});
