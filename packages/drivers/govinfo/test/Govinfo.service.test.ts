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
import { Context, Effect, Equal, Layer, pipe, Redacted, Ref, Result } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";
import * as HttpClient from "effect/unstable/http/HttpClient";
import * as HttpClientRequest from "effect/unstable/http/HttpClientRequest";
import * as HttpClientResponse from "effect/unstable/http/HttpClientResponse";
import * as RateLimiter from "effect/unstable/persistence/RateLimiter";
import type * as HttpClientError from "effect/unstable/http/HttpClientError";

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

const GovinfoConfigInputArbitrary = S.toArbitrary(GovinfoConfigInput)(fc).map((config) =>
  GovinfoConfigInput.make({ apiUrl: config.apiUrl })
);
const GovinfoErrorOptionsArbitrary = S.toArbitrary(GovinfoErrorOptions)(fc).map((options) =>
  GovinfoErrorOptions.make({ status: options.status })
);
const GovinfoErrorArbitrary = S.toArbitrary(GovinfoError)(fc).map((error) =>
  GovinfoError.of(error.reason, GovinfoErrorOptions.make({ status: error.status }))
);
const SearchFailureArbitrary = S.toArbitrary(Search.Failure)(fc).filter((failure) => O.isNone(failure.cause));

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

const assertSchemaRoundTrip = <Codec extends S.Codec<unknown, unknown>>(
  schema: Codec,
  arbitrary = S.toArbitrary(schema)(fc)
): void => {
  fc.assert(
    fc.property(arbitrary, (value) => {
      expectRoundTrip(schema, value);
    }),
    fcRuns(25)
  );
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
  it("keeps crispened schema encoded shapes stable", () => {
    expect(encode(GovinfoConfigInput, GovinfoConfigInput.make({}))).toEqual({
      apiUrl: GOVINFO_API_URL,
    });
    expect(O.isNone(GovinfoConfigInput.make({}).apiKey)).toBe(true);
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
    expect(encode(Sort, S.decodeSync(Sort)({ field: "publishdate", sortOrder: "DESC" }))).toEqual({
      field: "publishdate",
      sortOrder: "DESC",
    });
    expect(encode(SearchBody, S.decodeUnknownSync(SearchBody)(searchBodyEncoded))).toEqual(searchBodyEncoded);
    expect(encode(Search.Payload, S.decodeUnknownSync(Search.Payload)(searchBodyEncoded))).toEqual(searchBodyEncoded);
    expect(encode(SearchResult, S.decodeSync(SearchResult)(searchResultEncoded))).toEqual(searchResultEncoded);
    expect(encode(Search.Success, S.decodeSync(Search.Success)({ count: 1, offsetMark: "next", results: [] }))).toEqual(
      { count: 1, offsetMark: "next", results: [] }
    );
    expect(encode(GranuleMetadata, S.decodeSync(GranuleMetadata)(granuleMetadataEncoded))).toEqual(
      granuleMetadataEncoded
    );
    expect(encode(PackageInfo, S.decodeSync(PackageInfo)(packageInfoEncoded))).toEqual(packageInfoEncoded);
    expect(encode(SummaryItem, S.decodeSync(SummaryItem)(summaryItemEncoded))).toEqual(summaryItemEncoded);
    expect(encode(CollectionSummary, S.decodeSync(CollectionSummary)([summaryItemEncoded]))).toEqual([
      summaryItemEncoded,
    ]);
    expect(
      encode(
        GranuleContainer,
        S.decodeSync(GranuleContainer)({
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
        S.decodeSync(CollectionContainer)({
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
  });

  it("round-trips hand-authored schema-derived values through encoded form", () => {
    fc.assert(
      fc.property(S.toArbitrary(GovinfoHttpStatus)(fc), (status) => {
        expectRoundTrip(GovinfoHttpStatus, status);
      }),
      fcRuns(25)
    );

    assertSchemaRoundTrip(GovinfoConfigInput, GovinfoConfigInputArbitrary);
    assertSchemaRoundTrip(GovinfoErrorReason);
    assertSchemaRoundTrip(GovinfoErrorOptions, GovinfoErrorOptionsArbitrary);
    assertSchemaRoundTrip(GovinfoError, GovinfoErrorArbitrary);
    assertSchemaRoundTrip(Sort);
    assertSchemaRoundTrip(SearchBody);
    assertSchemaRoundTrip(Search.Payload);
    assertSchemaRoundTrip(Search.Success);
    assertSchemaRoundTrip(Search.Failure, SearchFailureArbitrary);
    assertSchemaRoundTrip(SearchResult);
    assertSchemaRoundTrip(GranuleMetadata);
    assertSchemaRoundTrip(PackageInfo);
    assertSchemaRoundTrip(SummaryItem);
    assertSchemaRoundTrip(CollectionSummary);
    assertSchemaRoundTrip(GranuleContainer);
    assertSchemaRoundTrip(CollectionContainer);
  });

  layer(makeGovinfoUnitLayer(keyedConfig))((it) =>
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
        expect(O.isSome(snapshot)).toBe(true);
        expect(snap.limit).toBe(1000);
        expect(snap.remaining).toBe(42);
        expect(snap.reset).toBe(60);
      })
    )
  );

  layer(makeGovinfoUnitLayer(keyedConfig))((it) =>
    it.effect(
      "serves a repeat identical search from cache (transport call-count == 1)",
      Effect.fnUntraced(function* () {
        const testHttp = yield* GovinfoTestHttp;
        const govinfo = yield* Govinfo;
        yield* testHttp.reset;

        yield* govinfo.search(makePayload());
        yield* govinfo.search(makePayload());

        const captures = yield* testHttp.captures;
        expect(captures).toHaveLength(1);
      })
    )
  );

  layer(makeGovinfoUnitLayer())((it) =>
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
