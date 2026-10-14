/**
 * Server-side observability layer composition for OTLP and devtools.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as Duration from "effect/Duration";
import { dual } from "effect/Function";
import * as Layer from "effect/Layer";
import * as Metric from "effect/Metric";
import * as Otlp from "effect/observability/Otlp";
import * as OtlpSerialization from "effect/observability/OtlpSerialization";
import { layerMinimumLogLevel } from "../Logging.ts";
import { ServerObservabilityConfig, toOtlpResource } from "./Config.ts";
import { layerFilteredDevTools } from "./DevTools.ts";
import type * as HttpClient from "effect/http/HttpClient";
import type { DevToolsSpanFilter } from "./DevTools.ts";

/**
 * Server-only local LGTM wiring for Effect OTLP + optional devtools.
 *
 * **Details**
 *
 * When both OTLP and devtools are enabled, the devtools tracer is built on top
 * of the OTLP tracer, so every span is exported over OTLP and mirrored to
 * devtools. OTLP payloads use the `otlpSerialization` layer, protobuf by
 * default, so a different serializer can be substituted without forking this
 * wiring.
 *
 * **Example** (Create local LGTM layer)
 *
 * ```typescript
 * import { ServerObservabilityConfig, layerLocalLgtmServer } from "@beep/observability/server"
 *
 * const config = ServerObservabilityConfig.make({
 *   devtoolsEnabled: false,
 *   devtoolsUrl: "ws://localhost:34437",
 *   environment: "test",
 *   minLogLevel: "Info",
 *   otlpBaseUrl: "http://localhost:4318",
 *   otlpEnabled: false,
 *   otlpResourceAttributes: {},
 *   prometheusPrefix: "beep",
 *   serviceName: "beep-api",
 *   serviceVersion: "0.0.0"
 * })
 * const ObservabilityLive = layerLocalLgtmServer(config)
 * console.log(ObservabilityLive)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const layerLocalLgtmServer: {
  (
    config: ServerObservabilityConfig,
    options?: {
      /** Span filter for devtools mirroring; defaults to publishing every span. */
      readonly shouldPublishDevToolsSpan?: DevToolsSpanFilter | undefined;
      /** OTLP payload encoding; defaults to `OtlpSerialization.layerProtobuf`. */
      readonly otlpSerialization?: Layer.Layer<OtlpSerialization.OtlpSerialization> | undefined;
    }
  ): Layer.Layer<never, never, HttpClient.HttpClient>;
  (options?: {
    /** Span filter for devtools mirroring; defaults to publishing every span. */
    readonly shouldPublishDevToolsSpan?: DevToolsSpanFilter | undefined;
    /** OTLP payload encoding; defaults to `OtlpSerialization.layerProtobuf`. */
    readonly otlpSerialization?: Layer.Layer<OtlpSerialization.OtlpSerialization> | undefined;
  }): (config: ServerObservabilityConfig) => Layer.Layer<never, never, HttpClient.HttpClient>;
} = dual(
  (args) => ServerObservabilityConfig.is(args[0]),
  (
    config: ServerObservabilityConfig,
    options?: {
      /** Span filter for devtools mirroring; defaults to publishing every span. */
      readonly shouldPublishDevToolsSpan?: DevToolsSpanFilter | undefined;
      /** OTLP payload encoding; defaults to `OtlpSerialization.layerProtobuf`. */
      readonly otlpSerialization?: Layer.Layer<OtlpSerialization.OtlpSerialization> | undefined;
    }
  ): Layer.Layer<never, never, HttpClient.HttpClient> => {
    const otlpLayer = config.otlpEnabled
      ? Otlp.layer({
          baseUrl: config.otlpBaseUrl,
          resource: toOtlpResource(config),
          loggerExportInterval: Duration.seconds(1),
          loggerMergeWithExisting: true,
          metricsExportInterval: Duration.seconds(10),
          metricsTemporality: "cumulative",
          tracerExportInterval: Duration.seconds(5),
          shutdownTimeout: Duration.seconds(3),
        }).pipe(Layer.provide(options?.otlpSerialization ?? OtlpSerialization.layerProtobuf))
      : Layer.empty;

    // DevTools wraps the tracer it finds while building, so OTLP must sit
    // underneath it; as mergeAll siblings DevTools replaced the OTLP tracer.
    const tracingLayer = config.devtoolsEnabled
      ? layerFilteredDevTools({
          url: config.devtoolsUrl,
          shouldPublish: options?.shouldPublishDevToolsSpan ?? (() => true),
        }).pipe(Layer.provideMerge(otlpLayer))
      : otlpLayer;

    return Layer.mergeAll(Metric.enableRuntimeMetricsLayer, layerMinimumLogLevel(config.minLogLevel), tracingLayer);
  }
);
