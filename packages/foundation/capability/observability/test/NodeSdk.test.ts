import {
  layerNodeSdkServer,
  layerNodeSdkServerTraces,
  makeNodeSdkServerConfig,
  makeNodeSdkServerTraceConfig,
  NodeSdkServerOptions,
  ServerObservabilityConfig,
} from "@beep/observability/server";
import { it } from "@beep/test-runner";
import * as OtelTracer from "@effect/opentelemetry/OtelTracer";
import { describe, expect } from "@effect/vitest";
import { BatchSpanProcessor, InMemorySpanExporter, SimpleSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { Duration, Effect, Layer } from "effect";
import * as A from "effect/Array";

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

  it.layer(
    Layer.suspend(() =>
      layerNodeSdkServer(serverConfig, {
        spanProcessor: [new SimpleSpanProcessor(new InMemorySpanExporter())],
      })
    ),
    { timeout: "10 seconds" }
  )((it) => {
    it.effect("provides OpenTelemetry spans when processors are configured", () =>
      Effect.gen(function* () {
        const otelSpan = yield* OtelTracer.currentOtelSpan;
        expect(otelSpan).toBeDefined();
      }).pipe(Effect.withSpan("node-sdk-test"))
    );
  });

  it("builds trace-only config for Phoenix smoke exports", () => {
    const sdkConfig = makeNodeSdkServerTraceConfig(serverConfig);

    expect(sdkConfig.metricReader).toEqual([]);
    expect(sdkConfig.logRecordProcessor).toEqual([]);
  });

  it.effect("builds trace-only OTLP span export config without metrics or logs", () =>
    Effect.gen(function* () {
      const sdkConfig = yield* Effect.acquireRelease(
        Effect.sync(() =>
          makeNodeSdkServerTraceConfig(
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
          )
        ),
        (config) =>
          Effect.forEach(
            A.ensure(config.spanProcessor ?? []),
            (processor) => Effect.promise(() => processor.shutdown()),
            { discard: true }
          )
      );

      expect(sdkConfig.metricReader).toEqual([]);
      expect(sdkConfig.logRecordProcessor).toEqual([]);
      expect(sdkConfig.spanProcessor).toEqual([expect.any(BatchSpanProcessor)]);
    })
  );

  it.layer(
    Layer.suspend(() =>
      layerNodeSdkServerTraces(serverConfig, {
        spanProcessor: [new SimpleSpanProcessor(new InMemorySpanExporter())],
      })
    ),
    { timeout: "10 seconds" }
  )((it) => {
    it.effect("provides spans from the trace-only layer", () =>
      Effect.gen(function* () {
        const otelSpan = yield* OtelTracer.currentOtelSpan;
        expect(otelSpan).toBeDefined();
      }).pipe(Effect.withSpan("node-sdk-trace-only-test"))
    );
  });
});
