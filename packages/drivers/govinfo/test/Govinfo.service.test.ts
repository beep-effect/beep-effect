import { RateLimitSnapshot } from "@beep/api-transport";
import {
  CollectionContainer,
  CollectionSummary,
  GOVINFO_API_URL,
  Govinfo,
  GovinfoConfigInput,
  GovinfoError,
  GovinfoErrorOptions,
  GovinfoErrorReason,
  GovinfoHttpStatus,
  GranuleContainer,
  GranuleMetadata,
  PackageInfo,
  Search,
  SearchBody,
  SearchResult,
  Sort,
  SummaryItem,
} from "@beep/govinfo";
import { $GovinfoId } from "@beep/identity";
import { PosInt, URLStr } from "@beep/schema";
import { fcRuns } from "@beep/test-utils";
import { describe, expect, it, layer } from "@effect/vitest";
import { assertNone, assertTrue } from "@effect/vitest/utils";
import { Context, Effect, Equal, Layer, pipe, Redacted, Ref, Result } from "effect";
import * as Arbitrary from "effect/Arbitrary";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import * as HttpClientResponse from "effect/http/HttpClientResponse";
import * as O from "effect/Option";
import * as RateLimiter from "effect/persistence/RateLimiter";
import * as S from "effect/Schema";
import type * as HttpClientError from "effect/http/HttpClientError";

const decodeCollectionContainer = S.decodeUnknownEffect(CollectionContainer);
const decodeCollectionSummary = S.decodeUnknownEffect(CollectionSummary);
const decodeGranuleContainer = S.decodeUnknownEffect(GranuleContainer);
const decodeGranuleMetadata = S.decodeUnknownEffect(GranuleMetadata);
const decodePackageInfo = S.decodeUnknownEffect(PackageInfo);
const decodeSearchSuccess = S.decodeUnknownEffect(Search.Success);
const decodeSearchResult = S.decodeUnknownEffect(SearchResult);
const decodeSort = S.decodeUnknownEffect(Sort);
const decodeSummaryItem = S.decodeUnknownEffect(SummaryItem);
const decodeUnknownSearchPayload = S.decodeUnknownEffect(Search.Payload);
const decodeUnknownSearchBody = S.decodeUnknownEffect(SearchBody);

const $TestI = $GovinfoId.create("Govinfo.service.test");

type CapturedRequest = {
  readonly method: string;
  readonly url: string;
};

type GovinfoTestRespond = (
  request: HttpClientRequest.HttpClientRequest
) => Effect.Effect<Response, HttpClientError.HttpClientError>;

type GovinfoTestHttpShape = {
  readonly captures: Effect.Effect<ReadonlyArray<CapturedRequest>>;
  readonly handle: GovinfoTestRespond;
  readonly reset: Effect.Effect<void>;
  readonly respondWith: (respond: GovinfoTestRespond) => Effect.Effect<void>;
};

class GovinfoTestHttp extends Context.Service<GovinfoTestHttp, GovinfoTestHttpShape>()($TestI`GovinfoTestHttp`) {}

const GovinfoConfigInputArbitrary = Arbitrary.schema(GovinfoConfigInput).pipe(
  Arbitrary.map((config) => GovinfoConfigInput.make({ apiUrl: config.apiUrl }))
);
const GovinfoErrorOptionsArbitrary = Arbitrary.schema(GovinfoErrorOptions).pipe(
  Arbitrary.map((options) => GovinfoErrorOptions.make({ status: options.status }))
);
const GovinfoErrorArbitrary = Arbitrary.schema(GovinfoError).pipe(
  Arbitrary.map((error) => GovinfoError.of(error.reason, GovinfoErrorOptions.make({ status: error.status })))
);
const SearchFailureArbitrary = Arbitrary.schema(Search.Failure).pipe(
  Arbitrary.filter((failure) => O.isNone(failure.cause))
);

const encode = <Codec extends S.Codec<unknown, unknown>>(schema: Codec, value: Codec["Type"]): Codec["Encoded"] =>
  Result.getOrThrow(S.encodeResult(schema)(value));

const decode = <Codec extends S.Codec<unknown, unknown>>(schema: Codec, value: Codec["Encoded"]): Codec["Type"] =>
  Result.getOrThrow(S.decodeUnknownResult(schema)(value));

const expectRoundTrip = <Codec extends S.Codec<unknown, unknown>>(schema: Codec, value: Codec["Type"]): void => {
  const encoded = encode(schema, value);
  const decoded = decode(schema, encoded);
  const reencoded = encode(schema, decoded);

  expect(reencoded).toEqual(encoded);
  expect(Equal.equals(decoded, value) || S.toEquivalence(schema)(decoded, value)).toBe(true);
};

const searchBodyEncoded = {
  historical: false,
  offsetMark: "*",
  pageSize: 10,
  query: "collection:(CREC) congress:118",
  resultLevel: "default",
  sorts: [{ field: "publishdate", sortOrder: "DESC" }],
};

const searchResultEncoded = {
  collectionCode: "CREC",
  dateIngested: "2024-01-03T00:00:00.000Z",
  dateIssued: "2024-01-03T00:00:00.000Z",
  download: { pdfLink: "https://api.govinfo.gov/packages/CREC-2024-01-03/pdf" },
  governmentAuthor: ["Government Publishing Office"],
  granuleId: "CREC-2024-01-03-pt1-PgH1",
  lastModified: "2024-01-04T12:00:00.000Z",
  packageId: "CREC-2024-01-03",
  resultLink: "https://api.govinfo.gov/packages/CREC-2024-01-03/summary",
  title: "Congressional Record, January 3, 2024",
};

const granuleMetadataEncoded = {
  granuleClass: "HOUSE",
  granuleId: "CREC-2024-01-03-pt1-PgH1",
  granuleLink: "https://api.govinfo.gov/packages/CREC-2024-01-03/granules/CREC-2024-01-03-pt1-PgH1/summary",
  md5: "d41d8cd98f00b204e9800998ecf8427e",
  title: "House proceedings",
};

const packageInfoEncoded = {
  congress: "118",
  dateIssued: "2024-01-03T00:00:00.000Z",
  docClass: "CREC",
  lastModified: "2024-01-04T12:00:00.000Z",
  packageLink: "https://api.govinfo.gov/packages/CREC-2024-01-03/summary",
  title: "Congressional Record, January 3, 2024",
};

const summaryItemEncoded = {
  collectionCode: "CREC",
  collectionName: "Congressional Record",
  granuleCount: BigInt(1200),
  packageCount: BigInt(450),
};

const searchBody = { count: 0, offsetMark: "*", results: [] };

const searchResponse = (headers: Readonly<Record<string, string>> = {}): Response =>
  Response.json(searchBody, { headers: { "content-type": "application/json", ...headers }, status: 200 });

const defaultRespond: GovinfoTestRespond = () => Effect.succeed(searchResponse());

const GovinfoTestHttpLayer = Layer.effect(
  GovinfoTestHttp,
  Effect.gen(function* () {
    const capturesRef = yield* Ref.make<ReadonlyArray<CapturedRequest>>([]);
    const respondRef = yield* Ref.make<GovinfoTestRespond>(defaultRespond);

    return GovinfoTestHttp.of({
      captures: Ref.get(capturesRef),
      handle: Effect.fn("GovinfoTestHttp.handle")(function* (request) {
        const url = pipe(
          HttpClientRequest.toUrl(request),
          O.map((value) => value.toString()),
          O.getOrElse(() => request.url)
        );
        yield* Ref.update(capturesRef, (xs) => [...xs, { method: request.method, url }]);
        const respond = yield* Ref.get(respondRef);
        return yield* respond(request);
      }),
      reset: Effect.all([Ref.set(capturesRef, []), Ref.set(respondRef, defaultRespond)], { discard: true }),
      respondWith: Effect.fn("GovinfoTestHttp.respondWith")(function* (respond) {
        yield* Ref.set(respondRef, respond);
      }),
    });
  })
);

const TestHttpClientLayer = Layer.effect(
  HttpClient.HttpClient,
  Effect.gen(function* () {
    const testHttp = yield* GovinfoTestHttp;
    return HttpClient.make((request) =>
      Effect.gen(function* () {
        const response = yield* testHttp.handle(request);
        return HttpClientResponse.fromWeb(request, response);
      })
    );
  })
);

const makeGovinfoUnitLayer = (config = GovinfoConfigInput.make({})) =>
  Govinfo.makeLayer(config).pipe(
    Layer.provide(TestHttpClientLayer),
    Layer.provideMerge(GovinfoTestHttpLayer),
    Layer.provide(RateLimiter.layerStoreMemory)
  );

const keyedConfig = GovinfoConfigInput.make({
  apiKey: O.some(Redacted.make("test-key")),
  apiUrl: URLStr.make(GOVINFO_API_URL),
});

const makePayload = () =>
  Search.Payload.make({
    historical: false,
    offsetMark: "*",
    pageSize: PosInt.make(10),
    query: "climate change",
    resultLevel: "default",
    sorts: [],
  });

describe("@beep/govinfo", () => {
  it.effect(
    "keeps crispened schema encoded shapes stable",
    Effect.fnUntraced(function* () {
      expect(encode(GovinfoConfigInput, GovinfoConfigInput.make({}))).toEqual({
        apiUrl: GOVINFO_API_URL,
      });
      assertNone(GovinfoConfigInput.make({}).apiKey);
      expect(encode(GovinfoErrorOptions, GovinfoErrorOptions.make({}))).toEqual({});
      expect(encode(GovinfoErrorOptions, GovinfoErrorOptions.make({ status: O.some(429) }))).toEqual({
        status: 429,
      });
      expect(GovinfoError.config().reason).toBe("config");
      expect(
        encode(GovinfoError, GovinfoError.of("response status", GovinfoErrorOptions.make({ status: O.some(429) })))
      ).toEqual({
        _tag: "GovinfoError",
        reason: "response status",
        status: 429,
      });
      expect(encode(Sort, yield* decodeSort({ field: "publishdate", sortOrder: "DESC" }))).toEqual({
        field: "publishdate",
        sortOrder: "DESC",
      });
      expect(encode(SearchBody, yield* decodeUnknownSearchBody(searchBodyEncoded))).toEqual(searchBodyEncoded);
      expect(encode(Search.Payload, yield* decodeUnknownSearchPayload(searchBodyEncoded))).toEqual(searchBodyEncoded);
      expect(encode(SearchResult, yield* decodeSearchResult(searchResultEncoded))).toEqual(searchResultEncoded);
      expect(encode(Search.Success, yield* decodeSearchSuccess({ count: 1, offsetMark: "next", results: [] }))).toEqual(
        {
          count: 1,
          offsetMark: "next",
          results: [],
        }
      );
      expect(encode(GranuleMetadata, yield* decodeGranuleMetadata(granuleMetadataEncoded))).toEqual(
        granuleMetadataEncoded
      );
      expect(encode(PackageInfo, yield* decodePackageInfo(packageInfoEncoded))).toEqual(packageInfoEncoded);
      expect(encode(SummaryItem, yield* decodeSummaryItem(summaryItemEncoded))).toEqual(summaryItemEncoded);
      expect(encode(CollectionSummary, yield* decodeCollectionSummary([summaryItemEncoded]))).toEqual([
        summaryItemEncoded,
      ]);
      expect(
        encode(
          GranuleContainer,
          yield* decodeGranuleContainer({
            count: BigInt(1),
            granules: [granuleMetadataEncoded],
            message: "",
            nextPage: "https://api.govinfo.gov/packages/CREC-2024-01-03/granules?offsetMark=next&pageSize=100",
            offset: 0,
            pageSize: 100,
            previousPage: "",
          })
        )
      ).toEqual({
        count: BigInt(1),
        granules: [granuleMetadataEncoded],
        message: "",
        nextPage: "https://api.govinfo.gov/packages/CREC-2024-01-03/granules?offsetMark=next&pageSize=100",
        offset: 0,
        pageSize: 100,
        previousPage: "",
      });
      expect(
        encode(
          CollectionContainer,
          yield* decodeCollectionContainer({
            count: 1,
            message: "",
            nextPage: "https://api.govinfo.gov/collections/CREC/2024-01-01T00:00:00Z?offsetMark=next&pageSize=10",
            packages: [packageInfoEncoded],
            previousPage: "",
          })
        )
      ).toEqual({
        count: 1,
        message: "",
        nextPage: "https://api.govinfo.gov/collections/CREC/2024-01-01T00:00:00Z?offsetMark=next&pageSize=10",
        packages: [packageInfoEncoded],
        previousPage: "",
      });
    })
  );

  it.prop(
    "round-trips hand-authored schema-derived values through encoded form",
    {
      GovinfoHttpStatus: Arbitrary.schema(GovinfoHttpStatus),
      GovinfoConfigInput: GovinfoConfigInputArbitrary,
      GovinfoErrorReason: Arbitrary.schema(GovinfoErrorReason),
      GovinfoErrorOptions: GovinfoErrorOptionsArbitrary,
      GovinfoError: GovinfoErrorArbitrary,
      Sort: Arbitrary.schema(Sort),
      SearchBody: Arbitrary.schema(SearchBody),
      SearchPayload: Arbitrary.schema(Search.Payload),
      SearchSuccess: Arbitrary.schema(Search.Success),
      SearchFailure: SearchFailureArbitrary,
      SearchResult: Arbitrary.schema(SearchResult),
      GranuleMetadata: Arbitrary.schema(GranuleMetadata),
      PackageInfo: Arbitrary.schema(PackageInfo),
      SummaryItem: Arbitrary.schema(SummaryItem),
      CollectionSummary: Arbitrary.schema(CollectionSummary),
      GranuleContainer: Arbitrary.schema(GranuleContainer),
      CollectionContainer: Arbitrary.schema(CollectionContainer),
    },
    (values) => {
      expectRoundTrip(GovinfoHttpStatus, values.GovinfoHttpStatus);
      expectRoundTrip(GovinfoConfigInput, values.GovinfoConfigInput);
      expectRoundTrip(GovinfoErrorReason, values.GovinfoErrorReason);
      expectRoundTrip(GovinfoErrorOptions, values.GovinfoErrorOptions);
      expectRoundTrip(GovinfoError, values.GovinfoError);
      expectRoundTrip(Sort, values.Sort);
      expectRoundTrip(SearchBody, values.SearchBody);
      expectRoundTrip(Search.Payload, values.SearchPayload);
      expectRoundTrip(Search.Success, values.SearchSuccess);
      expectRoundTrip(Search.Failure, values.SearchFailure);
      expectRoundTrip(SearchResult, values.SearchResult);
      expectRoundTrip(GranuleMetadata, values.GranuleMetadata);
      expectRoundTrip(PackageInfo, values.PackageInfo);
      expectRoundTrip(SummaryItem, values.SummaryItem);
      expectRoundTrip(CollectionSummary, values.CollectionSummary);
      expectRoundTrip(GranuleContainer, values.GranuleContainer);
      expectRoundTrip(CollectionContainer, values.CollectionContainer);
    },
    { arbitrary: fcRuns(25) }
  );

  layer(makeGovinfoUnitLayer(keyedConfig), { timeout: "10 seconds" })((it) =>
    it.effect(
      "attaches api.data.gov api_key and parses X-RateLimit-* headers offline",
      Effect.fnUntraced(function* () {
        const testHttp = yield* GovinfoTestHttp;
        const govinfo = yield* Govinfo;
        yield* testHttp.reset;
        yield* testHttp.respondWith(() =>
          Effect.succeed(
            searchResponse({
              "x-ratelimit-limit": "1000",
              "x-ratelimit-remaining": "42",
              "x-ratelimit-reset": "60",
            })
          )
        );

        const result = yield* govinfo.search(makePayload());
        const snapshot = yield* govinfo.rateLimit;
        const captures = yield* testHttp.captures;
        const snap = O.getOrElse(snapshot, () => RateLimitSnapshot.make({}));

        expect(result.count).toBe(0);
        expect(captures).toHaveLength(1);
        expect(captures[0]?.url).toContain("api_key=test-key");
        snapshot.pipe(O.isSome, assertTrue);
        expect(snap.limit).toBe(1000);
        expect(snap.remaining).toBe(42);
        expect(snap.reset).toBe(60);
      })
    )
  );

  layer(makeGovinfoUnitLayer(keyedConfig), { timeout: "10 seconds" })((it) =>
    it.effect(
      "serves a repeat identical search from cache (transport call-count == 1)",
      Effect.fnUntraced(function* () {
        const testHttp = yield* GovinfoTestHttp;
        const govinfo = yield* Govinfo;
        yield* testHttp.reset;

        const encoded = { count: 1, offsetMark: "cached-next", results: [searchResultEncoded] };
        const expected = yield* decodeSearchSuccess(encoded);
        yield* testHttp.respondWith(() => Effect.succeed(Response.json(encoded)));

        const first = yield* govinfo.search(makePayload());
        const second = yield* govinfo.search(makePayload());

        expect(first).toStrictEqual(expected);
        expect(second).toStrictEqual(expected);
        const captures = yield* testHttp.captures;
        expect(captures).toHaveLength(1);
      })
    )
  );

  layer(makeGovinfoUnitLayer(), { timeout: "10 seconds" })((it) =>
    it.effect(
      "omits auth gracefully when no API key is configured (keyless-safe)",
      Effect.fnUntraced(function* () {
        const testHttp = yield* GovinfoTestHttp;
        const govinfo = yield* Govinfo;
        yield* testHttp.reset;

        yield* govinfo.search(makePayload());

        const captures = yield* testHttp.captures;
        expect(captures).toHaveLength(1);
        expect(captures[0]?.url ?? "").not.toContain("api_key");
      })
    )
  );
});
