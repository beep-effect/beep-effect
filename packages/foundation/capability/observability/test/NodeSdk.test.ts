import {
  layerNodeSdkServer,
  layerNodeSdkServerTraces,
  makeNodeSdkServerTraceConfig,
  ServerObservabilityConfig,
} from "@beep/observability/server";
import * as OtelTracer from "@effect/opentelemetry/OtelTracer";
import { InMemorySpanExporter, SimpleSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";

const provideScopedLayer =
  <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E | E2, RIn | Exclude<R, ROut>> =>
    Effect.scoped(Layer.build(layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

const serverConfig = ServerObservabilityConfig.make({
  serviceName: "beep-server",
  serviceVersion: "0.0.0",
  environment: "test",
  minLogLevel: "Info",
  otlpBaseUrl: "http://localhost:4318",
  otlpEnabled: false,
  otlpResourceAttributes: {},
  devtoolsEnabled: false,
  devtoolsUrl: "ws://localhost:34437",
  prometheusPrefix: "beep",
});

const withOtlpTraceSink = (use: (baseUrl: string, contentType: Promise<string>) => Promise<void>) =>
  Effect.runPromise(
    Effect.gen(function* () {
      const { promise: contentType, resolve: resolveContentType } = Promise.withResolvers<string>();
      const server = Bun.serve({
        fetch: (request) => {
          const path = new URL(request.url).pathname;
          if (path === "/v1/traces") {
            resolveContentType(request.headers.get("content-type") ?? "");
          }

          return new Response(null, { status: 200 });
        },
        hostname: "127.0.0.1",
        port: 0,
      });

      try {
        yield* Effect.promise(() => Promise.resolve(use(`http://127.0.0.1:${server.port}`, contentType)));
      } finally {
        yield* Effect.promise(() => Promise.resolve(server.stop(true)));
      }
    })
  );

describe("NodeSdk", () => {
  it("provides OpenTelemetry spans when processors are configured", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const exporter = new InMemorySpanExporter();

        yield* Effect.gen(function* () {
          const otelSpan = yield* OtelTracer.currentOtelSpan;
          expect(otelSpan).toBeDefined();
        }).pipe(
          Effect.withSpan("node-sdk-test"),
          provideScopedLayer(
            layerNodeSdkServer(serverConfig, {
              spanProcessor: [new SimpleSpanProcessor(exporter)],
            })
          )
        );
      })
    ));

  it("builds trace-only config for Phoenix smoke exports", () => {
    const sdkConfig = makeNodeSdkServerTraceConfig(serverConfig);

    expect(sdkConfig.metricReader).toEqual([]);
    expect(sdkConfig.logRecordProcessor).toEqual([]);
  });

  it("exports trace-only OTLP spans as protobuf", () =>
    Effect.runPromise(
      Effect.promise(() =>
        Promise.resolve(
          withOtlpTraceSink((otlpBaseUrl, contentType) =>
            Effect.runPromise(
              Effect.gen(function* () {
                yield* Effect.void.pipe(
                  Effect.withSpan("node-sdk-protobuf-export-test"),
                  provideScopedLayer(
                    layerNodeSdkServerTraces(
                      ServerObservabilityConfig.make({
                        devtoolsEnabled: false,
                        devtoolsUrl: "ws://localhost:34437",
                        environment: "test",
                        minLogLevel: "Info",
                        otlpBaseUrl,
                        otlpEnabled: true,
                        otlpResourceAttributes: {},
                        prometheusPrefix: "beep",
                        serviceName: "beep-server",
                        serviceVersion: "0.0.0",
                      })
                    )
                  )
                );

                const receivedContentType = yield* Effect.promise(() =>
                  Promise.resolve(Promise.race([contentType, Bun.sleep(5_000).then(() => "timeout")]))
                );
                expect(receivedContentType).toContain("application/x-protobuf");
              })
            )
          )
        )
      )
    ));

  it("provides spans from the trace-only layer", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const exporter = new InMemorySpanExporter();

        yield* Effect.gen(function* () {
          const otelSpan = yield* OtelTracer.currentOtelSpan;
          expect(otelSpan).toBeDefined();
        }).pipe(
          Effect.withSpan("node-sdk-trace-only-test"),
          provideScopedLayer(
            layerNodeSdkServerTraces(serverConfig, {
              spanProcessor: [new SimpleSpanProcessor(exporter)],
            })
          )
        );
      })
    ));
});
