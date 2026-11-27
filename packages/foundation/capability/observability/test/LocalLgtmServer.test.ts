import { layerLocalLgtmServer, ServerObservabilityConfig } from "@beep/observability/server";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientResponse from "effect/http/HttpClientResponse";
import * as Layer from "effect/Layer";
import * as OtlpSerialization from "effect/observability/OtlpSerialization";
import * as Tracer from "effect/Tracer";

type CapturedRequest = {
  readonly url: string;
  readonly contentType: string | undefined;
};

const makeCapturingHttpClient = () => {
  const requests: Array<CapturedRequest> = [];
  const layer = Layer.succeed(
    HttpClient.HttpClient,
    HttpClient.make((request) =>
      Effect.sync(() => {
        requests.push({
          url: request.url,
          contentType: request.body._tag === "Uint8Array" ? request.body.contentType : undefined,
        });
        return HttpClientResponse.fromWeb(request, new Response(null, { status: 200 }));
      })
    )
  );
  return { requests, layer };
};

const unreachableDevToolsUrl = "ws://127.0.0.1:9";

const makeConfig = (devtoolsEnabled: boolean) =>
  ServerObservabilityConfig.make({
    devtoolsEnabled,
    devtoolsUrl: unreachableDevToolsUrl,
    environment: "test",
    minLogLevel: "Info",
    otlpBaseUrl: "http://otlp.test:4318",
    otlpEnabled: true,
    otlpResourceAttributes: {},
    prometheusPrefix: "beep",
    serviceName: "beep-test",
    serviceVersion: "0.0.0",
  });

const runThenFlushExporters = <A, E, ROut>(effect: Effect.Effect<A, E, ROut>, layer: Layer.Layer<ROut>) =>
  Layer.build(layer).pipe(
    Effect.flatMap((context) => Effect.provideContext(effect, context)),
    Effect.scoped
  );

const tracesRequests = (requests: ReadonlyArray<CapturedRequest>) =>
  A.filter(requests, (request) => request.url === "http://otlp.test:4318/v1/traces");

describe("layerLocalLgtmServer", () => {
  it.live(
    "exports spans over OTLP when devtools is also enabled, on the live clock the devtools connect timeout needs",
    Effect.fnUntraced(function* () {
      const http = makeCapturingHttpClient();
      const span = yield* runThenFlushExporters(
        Effect.currentSpan.pipe(Effect.withSpan("lgtm.both-enabled")),
        layerLocalLgtmServer(makeConfig(true)).pipe(Layer.provide(http.layer))
      );

      expect(span).not.toBeInstanceOf(Tracer.NativeSpan);
      expect(tracesRequests(http.requests)).toHaveLength(1);
    }),
    { timeout: 20_000 }
  );

  it.effect(
    "serializes OTLP payloads as protobuf by default",
    Effect.fnUntraced(function* () {
      const http = makeCapturingHttpClient();
      yield* runThenFlushExporters(
        Effect.void.pipe(Effect.withSpan("lgtm.protobuf")),
        layerLocalLgtmServer(makeConfig(false)).pipe(Layer.provide(http.layer))
      );

      expect(A.map(tracesRequests(http.requests), (request) => request.contentType)).toStrictEqual([
        "application/x-protobuf",
      ]);
    }),
    { timeout: 20_000 }
  );

  it.effect(
    "accepts a substitute OTLP serializer",
    Effect.fnUntraced(function* () {
      const http = makeCapturingHttpClient();
      yield* runThenFlushExporters(
        Effect.void.pipe(Effect.withSpan("lgtm.json")),
        layerLocalLgtmServer(makeConfig(false), { otlpSerialization: OtlpSerialization.layerJson }).pipe(
          Layer.provide(http.layer)
        )
      );

      expect(A.map(tracesRequests(http.requests), (request) => request.contentType)).toStrictEqual([
        "application/json",
      ]);
    }),
    { timeout: 20_000 }
  );

  it("keeps the data-last form", () => {
    expect(Layer.isLayer(layerLocalLgtmServer()(makeConfig(false)))).toBe(true);
  });
});
