import { ECFR_API_URL, Ecfr, EcfrConfigInput, EcfrError, EcfrErrorOptions, EcfrErrorReason } from "@beep/ecfr";
import { $EcfrId } from "@beep/identity";
import { NonNegativeInt } from "@beep/schema";
import { fcRuns } from "@beep/test-utils";
import { O } from "@beep/utils";
import { describe, expect, it, layer } from "@effect/vitest";
import { Context, Effect, Layer, pipe, Ref, Result } from "effect";
import * as S from "effect/Schema";
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
        return Response.json(titlesBody, { headers: { "content-type": "application/json" }, status: 200 });
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
});
