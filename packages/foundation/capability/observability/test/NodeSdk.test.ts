import {
  layerNodeSdkServer,
  layerNodeSdkServerTraces,
  makeNodeSdkServerConfig,
  makeNodeSdkServerTraceConfig,
  NodeSdkServerOptions,
  ServerObservabilityConfig,
} from "@beep/observability/server";
import * as OtelTracer from "@effect/opentelemetry/OtelTracer";
import { BatchSpanProcessor, InMemorySpanExporter, SimpleSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { Duration, Effect, Layer } from "effect";
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

describe("NodeSdk", () => {
  it("resolves local server option defaults through the schema", () => {
    const options = NodeSdkServerOptions.make({});
    const sdkConfig = makeNodeSdkServerConfig(serverConfig);

    expect(Duration.toMillis(Duration.fromInputUnsafe(options.loggerExportInterval))).toBe(1_000);
    expect(Duration.toMillis(Duration.fromInputUnsafe(options.metricsExportInterval))).toBe(10_000);
    expect(options.loggerMergeWithExisting).toBe(true);
    expect(options.metricTemporality).toBe("cumulative");
    expect(Duration.toMillis(Duration.fromInputUnsafe(options.shutdownTimeout))).toBe(3_000);
    expect(sdkConfig.loggerMergeWithExisting).toBe(true);
    expect(sdkConfig.metricTemporality).toBe("cumulative");
    expect(sdkConfig.shutdownTimeout).toStrictEqual(Duration.seconds(3));
  });

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

  it("builds trace-only OTLP span export config without metrics or logs", () => {
    const sdkConfig = makeNodeSdkServerTraceConfig(
      ServerObservabilityConfig.make({
        devtoolsEnabled: false,
        devtoolsUrl: "ws://localhost:34437",
        environment: "test",
        minLogLevel: "Info",
        otlpBaseUrl: "http://127.0.0.1:4318",
        otlpEnabled: true,
        otlpResourceAttributes: {},
        prometheusPrefix: "beep",
        serviceName: "beep-server",
        serviceVersion: "0.0.0",
      })
    );

    expect(sdkConfig.metricReader).toEqual([]);
    expect(sdkConfig.logRecordProcessor).toEqual([]);
    expect(sdkConfig.spanProcessor).toEqual([expect.any(BatchSpanProcessor)]);
  });

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
