import {
  SANITY_API_VERSION,
  Sanity,
  SanityConfigInput,
  SanityError,
  SanityErrorOptions,
  SanityErrorReason,
  SanityQueryParamValue,
  SanityQueryRequest,
  SanityQueryResponse,
} from "@beep/sanity";
import { fcRuns } from "@beep/test-utils";
import { A } from "@beep/utils";
import * as O from "@beep/utils/Option";
import { describe, expect, it, layer } from "@effect/vitest";
import { Cause, Context, Effect, Exit, Layer, Redacted, Ref, Result } from "effect";
import * as Equal from "effect/Equal";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";
import * as HttpClient from "effect/unstable/http/HttpClient";
import * as HttpClientRequest from "effect/unstable/http/HttpClientRequest";
import * as HttpClientResponse from "effect/unstable/http/HttpClientResponse";
import type * as HttpClientError from "effect/unstable/http/HttpClientError";

type CapturedRequest = {
  readonly bodyText: O.Option<string>;
  readonly headers: Readonly<Record<string, string>>;
  readonly method: string;
  readonly url: string;
};

type TestRespond = (
  request: HttpClientRequest.HttpClientRequest
) => Effect.Effect<Response, HttpClientError.HttpClientError>;

type SanityTestHttpShape = {
  readonly captures: Effect.Effect<ReadonlyArray<CapturedRequest>>;
  readonly handle: TestRespond;
  readonly respondWith: (respond: TestRespond) => Effect.Effect<void>;
};

class SanityTestHttp extends Context.Service<SanityTestHttp, SanityTestHttpShape>()(
  "@beep/sanity/test/Sanity.service.test/SanityTestHttp"
) {}

const CapturedSanityRequestBody = S.Struct({
  params: S.Record(S.String, SanityQueryParamValue),
  query: S.String,
});
const CapturedSanityRequestBodyJson = S.fromJsonString(CapturedSanityRequestBody);
const ConfigInputArbitrary = S.toArbitrary(SanityConfigInput).filter((config) => config.apiToken === undefined);
const QueryParamValueArbitrary = S.toArbitrary(SanityQueryParamValue);
const QueryRequestArbitrary = S.toArbitrary(SanityQueryRequest);
const QueryResponseArbitrary = S.toArbitrary(SanityQueryResponse);
const ErrorReasonArbitrary = S.toArbitrary(SanityErrorReason);
const ErrorOptionsArbitrary = S.toArbitrary(SanityErrorOptions).map((options) =>
  SanityErrorOptions.make(
    O.getSomesStruct({
      status: O.fromUndefinedOr(options.status),
      url: O.fromUndefinedOr(options.url),
    })
  )
);
const ErrorArbitrary = fc
  .tuple(ErrorReasonArbitrary, ErrorOptionsArbitrary)
  .map(([reason, options]) => SanityError.fromReason(reason, options));

const encode = <Codec extends S.Codec<unknown, unknown>>(schema: Codec, value: Codec["Type"]): Codec["Encoded"] =>
  Result.getOrThrow(S.encodeResult(schema)(value));

const decode = <Codec extends S.Codec<unknown, unknown>>(schema: Codec, value: Codec["Encoded"]): Codec["Type"] =>
  Result.getOrThrow(S.decodeUnknownResult(schema)(value));

const expectRoundTrip = <Codec extends S.Codec<unknown, unknown>>(schema: Codec, value: Codec["Type"]): void => {
  const encoded = encode(schema, value);
  const decoded = decode(schema, encoded);

  expect(Equal.equals(decoded, value)).toBe(true);
  expect(encode(schema, decoded)).toEqual(encoded);
};

const bodyTextFor = (request: HttpClientRequest.HttpClientRequest): O.Option<string> =>
  request.body._tag === "Uint8Array" ? O.some(new TextDecoder().decode(request.body.body)) : O.none();

const makeJsonResponse = (body: unknown, status = 200) =>
  Response.json(body, {
    headers: {
      "content-type": "application/json",
    },
    status,
  });

const defaultRespond: TestRespond = () => Effect.succeed(makeJsonResponse({ result: { ok: true }, ms: 3 }));

const SanityTestHttpLayer = Layer.effect(
  SanityTestHttp,
  Effect.gen(function* () {
    const capturesRef = yield* Ref.make<ReadonlyArray<CapturedRequest>>([]);
    const respondRef = yield* Ref.make<TestRespond>(defaultRespond);

    return SanityTestHttp.of({
      captures: Ref.get(capturesRef),
      handle: Effect.fn("SanityTestHttp.handle")(function* (request) {
        const url = HttpClientRequest.toUrl(request).pipe(
          O.map((value) => value.toString()),
          O.getOrElse(() => request.url)
        );

        yield* Ref.update(
          capturesRef,
          A.append({
            headers: request.headers,
            method: request.method,
            url,
            bodyText: bodyTextFor(request),
          })
        );

        const respond = yield* Ref.get(respondRef);
        return yield* respond(request);
      }),
      respondWith: Effect.fn("SanityTestHttp.respondWith")(function* (respond) {
        yield* Ref.set(respondRef, respond);
      }),
    });
  })
);

const TestHttpClientLayer = Layer.effect(
  HttpClient.HttpClient,
  Effect.gen(function* () {
    const testHttp = yield* SanityTestHttp;

    return HttpClient.make((request) =>
      Effect.gen(function* () {
        const response = yield* testHttp.handle(request);
        return HttpClientResponse.fromWeb(request, response);
      })
    );
  })
);

const TestLayer = Sanity.makeLayer(
  SanityConfigInput.make({
    apiToken: Redacted.make("sanity-token"),
    dataset: "production",
    projectId: "oip",
  })
).pipe(Layer.provide(TestHttpClientLayer), Layer.provideMerge(SanityTestHttpLayer));

describe("@beep/sanity", () => {
  it("keeps encoded Sanity schema wire shapes byte-identical", () => {
    const decodedConfig = decode(SanityConfigInput, {
      apiHost: "https://api.sanity.io///",
      dataset: "production",
      projectId: "oip",
    });
    const request = SanityQueryRequest.make({
      query: "*[_type == 'oipSiteContent'][0]",
    });
    const response = decode(SanityQueryResponse, {
      ms: 7,
      result: { title: "Home" },
    });
    const errorOptions = SanityErrorOptions.make({
      status: 500,
      url: "https://api.sanity.io/v2025-05-14/data/query/production",
    });
    const error = SanityError.fromReason("response status", errorOptions);

    expect(decodedConfig.apiHost).toBe("https://api.sanity.io");
    expect(encode(SanityConfigInput, decodedConfig)).toEqual({
      apiHost: "https://api.sanity.io",
      apiVersion: SANITY_API_VERSION,
      dataset: "production",
      headers: {},
      projectId: "oip",
    });
    expect(encode(SanityQueryRequest, request)).toEqual({
      params: {},
      query: "*[_type == 'oipSiteContent'][0]",
    });
    expect(encode(SanityQueryResponse, response)).toEqual({
      ms: 7,
      result: { title: "Home" },
    });
    expect(encode(SanityErrorOptions, errorOptions)).toEqual({
      status: 500,
      url: "https://api.sanity.io/v2025-05-14/data/query/production",
    });
    expect(encode(SanityError, error)).toEqual({
      _tag: "SanityError",
      reason: "response status",
      status: 500,
      url: "https://api.sanity.io/v2025-05-14/data/query/production",
    });
    expect(Result.isFailure(S.decodeResult(SanityQueryResponse)({ ms: -1, result: null }))).toBe(true);
    expect(
      Result.isFailure(
        S.decodeResult(SanityError)({
          _tag: "SanityError",
          reason: "response status",
          status: 99,
        })
      )
    ).toBe(true);
  });

  it("round-trips schema-derived Sanity payloads through encoded form", () =>
    fc.assert(
      fc.property(
        ConfigInputArbitrary,
        QueryParamValueArbitrary,
        QueryRequestArbitrary,
        QueryResponseArbitrary,
        ErrorReasonArbitrary,
        ErrorOptionsArbitrary,
        ErrorArbitrary,
        (config, queryParamValue, queryRequest, queryResponse, errorReason, errorOptions, error) => {
          const normalizedConfig = decode(SanityConfigInput, encode(SanityConfigInput, config));

          expectRoundTrip(SanityConfigInput, normalizedConfig);
          expectRoundTrip(SanityQueryParamValue, queryParamValue);
          expectRoundTrip(SanityQueryRequest, queryRequest);
          expectRoundTrip(SanityQueryResponse, queryResponse);
          expectRoundTrip(SanityErrorReason, errorReason);
          expectRoundTrip(SanityErrorOptions, errorOptions);
          expectRoundTrip(SanityError, error);
        }
      ),
      fcRuns(50)
    ));

  layer(TestLayer)((it) => {
    it.effect(
      "submits a GROQ query and decodes the result envelope",
      Effect.fnUntraced(function* () {
        const sanity = yield* Sanity;
        const response = yield* sanity.fetch(SanityQueryRequest.make({ query: "*[_type == 'oipSiteContent'][0]" }));
        const testHttp = yield* SanityTestHttp;
        const captures = yield* testHttp.captures;

        expect(response.result).toEqual({ ok: true });
        expect(response.ms).toEqual(O.some(3));
        expect(captures[0]?.method).toBe("POST");
        expect(captures[0]?.url).toBe("https://oip.api.sanity.io/v2025-05-14/data/query/production");
        expect(captures[0]?.headers.authorization).toBe("Bearer sanity-token");
        expect(decode(CapturedSanityRequestBodyJson, O.getOrThrow(captures[0]?.bodyText ?? O.none()))).toEqual({
          params: {},
          query: "*[_type == 'oipSiteContent'][0]",
        });
      })
    );

    it.effect(
      "maps non-success responses to typed driver errors",
      Effect.fnUntraced(function* () {
        const testHttp = yield* SanityTestHttp;
        yield* testHttp.respondWith(() => Effect.succeed(makeJsonResponse({ message: "nope" }, 500)));

        const sanity = yield* Sanity;
        const exit = yield* Effect.exit(sanity.fetch(SanityQueryRequest.make({ query: "*[]" })));

        expect(Exit.isFailure(exit)).toBe(true);
        if (Exit.isFailure(exit)) {
          const error = Cause.findErrorOption(exit.cause);
          expect(O.isSome(error)).toBe(true);
          if (O.isSome(error)) {
            expect(error.value).toBeInstanceOf(SanityError);
            expect(error.value.reason).toBe("response status");
            expect(error.value.status).toBe(500);
          }
        }
      })
    );
  });
});
